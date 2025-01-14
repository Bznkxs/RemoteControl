import OpenAI from "openai";
import fs from "fs";



export class OpenAIChatStudentExpertPair {
    constructor(configPath="env/openai/config.json", messageUpdateCallback=undefined) {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.openai = new OpenAI({
            organization: this.config.organization,
            project: this.config.project,
            // apiKey: process.env.OPENAI_API_KEY, // OPENAI_API_KEY is set in environment variables
        });
        this.studentSystemPrompt = this.config.studentSystemPrompt;
        this.expertSystemPrompt = this.config.expertSystemPrompt;
        this.expertUserInitialPrompt = this.config.expertUserInitialPrompt;
        this.temperature = this.config.temperature || 1;
        this.max_completion_tokens = this.config.max_completion_tokens || 16383;
        this.top_p = this.config.top_p || 1;
        this.frequency_penalty = this.config.frequency_penalty || 0;
        this.presence_penalty = this.config.presence_penalty || 0;
        this.messageUpdateCallback = messageUpdateCallback || (() => {});
        this.forceStop = false;
    }

    forceStopChat() {
        this.forceStop = true;
    }

    async streamChat(messages, callback) {
        const chatConfig = {
            model: "chatgpt-4o-latest",
            messages: messages,
            stream: true,
            temperature: this.temperature,
            max_completion_tokens: this.max_completion_tokens,
            top_p: this.top_p,
            frequency_penalty: this.frequency_penalty,
            presence_penalty: this.presence_penalty,
        }
        console.log("Send messages: ", messages[messages.length-1])
        const stream = await this.openai.chat.completions.create(chatConfig);
        for await (const chunk of stream) {
            console.log("Chunk: ", chunk.choices[0]?.delta?.content || "")
            callback(chunk.choices[0]?.delta?.content || "");
        }
    }

    startChat(problemText) {
        if (!(problemText.trimStart().startsWith("Problem"))) {
            problemText = "\nProblem\n" + problemText;
        }
        let problem, tutorial;
        problemText.split("Tutorial", 1).forEach((section) => {
            if (section.trimStart().startsWith("Problem")) {
                problem = section;
            } else {
                tutorial = "Tutorial\n" + section;
            }
        });
        const expertMessages = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": this.expertSystemPrompt + problemText
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": this.expertUserInitialPrompt
                    }
                ]
            }
        ];
        const studentChatHistory = [];
        const expertChatHistory = [];

        const studentMessages = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": this.studentSystemPrompt
                    }
                ]
            },
        ];
        this.studentMessages = studentMessages;
        this.expertMessages = expertMessages;
        this.studentChatHistory = studentChatHistory;
        this.expertChatHistory = expertChatHistory;
        let response = "";
        const messageCallback = (role, delta) => {
            console.log("MessageUpdateCallback", {role, delta})
            this.messageUpdateCallback({
                role: role,
                delta: delta
            });
            response += delta;
        }
        const executeUntilEnd = (role="expert") => {
            if (this.forceStop) {
                return;
            }
            let messages, chatHistory, otherMessages, otherRole;
            if (role === "expert") {
                messages = expertMessages;
                chatHistory = expertChatHistory;
                otherMessages = studentMessages;
                otherRole = "student";
            } else {
                messages = studentMessages;
                chatHistory = studentChatHistory;
                otherMessages = expertMessages;
                otherRole = "expert";
            }
            return this.streamChat(messages, (delta) => {messageCallback(role, delta)}).then(() => {
                console.log("THEN")
                chatHistory.push(response);
                if (role === "expert" && response.search(/[Pp]roblem\s+(is\s+)?solved/) !== -1 ) {
                    return;
                }
                messages.push({
                    "role": "assistant",
                    "content": [
                        {
                            "type": "text",
                            "text": response
                        }
                    ]
                });
                if (role === "expert" && studentChatHistory.length === 0) { // the first run
                    otherMessages.push({
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": problem + "\n" + response
                            }
                        ]
                    });
                }
                else {
                    otherMessages.push({
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": response
                            }
                        ]
                    });
                }
                response = "";

                return executeUntilEnd(otherRole);
            });
        }
        executeUntilEnd().then(() => {
            this.messageUpdateCallback({
                role: "system",
                delta: "Problem solved."
            });
            // save the chat history
            fs.writeFileSync("env/openai/student_chat_history.json", JSON.stringify(studentChatHistory, null, 4));
            fs.writeFileSync("env/openai/expert_chat_history.json", JSON.stringify(expertChatHistory, null, 4));
            fs.writeFileSync("env/openai/student_messages.json", JSON.stringify(studentMessages, null, 4));
            fs.writeFileSync("env/openai/expert_messages.json", JSON.stringify(expertMessages, null, 4));
        })
    }
}
