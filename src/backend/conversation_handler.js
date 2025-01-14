// const {ipcMain} = require ('electron');
// const {CommandProcessor} = require("./command_processor");
// const {TerminalInterface} = require("./terminal_interface");
// const fs = require("fs");
// const fileType = require('file-type');
//
// const requireESM = require('esm')(module);
// const {Log} = requireESM("../shared/message_log");
// const {TextClass} = requireESM("../shared/text_class");
// const {TerminalCommandLogMessage, TerminalTextLogMessage} = requireESM("../shared/message");
// const {getPureTextFromAnsiOutputStream} = requireESM("../shared/get_pure_text_from_ansi_output_stream.js");

// ESM style:


import {ContextManager} from "./context_manager.js";

const {ipcMain, shell} = await import ('electron');
import {CommandProcessor} from './command_processor.js';
import {TerminalInterface} from './terminal_interface.js';
import * as fs from 'fs';
import * as FileType from 'file-type';
import {Log} from '../shared/message_log.js';
import {TextClass} from '../shared/text_class.js';
import {TerminalCommandLogMessage, TerminalTextLogMessage} from '../shared/message.js';


export class Channel {
    constructor(window, channelName) {
        this.window = window;
        this.channelName = channelName;
        this.callbacks = [];
        ipcMain.on('remove-channel', (event, channelName) => {
            if (channelName === this.channelName) {
                this.destroy();
            }
        });
    }

    destroy() {
        this.callbacks.forEach(([channelName, listener]) => {
            ipcMain.removeListener(channelName, listener);
        });
    }

    onEvent(channelName, callback) {
        const listener = (event, ...args) => {
            callback(...args);
        }
        ipcMain.on(channelName, listener);
        this.callbacks.push([channelName, listener]);
    }

    /**
     *
     * @param {function(string)} callback
     */
    onSendInput(callback) {
        this.onEvent('channel-send-input-' + this.channelName, callback);
    }

    onSendCommand(callback) {
        this.onEvent('channel-send-command-' + this.channelName, callback);
    }

    onSendSignal(callback) {
        this.onEvent('channel-signal-' + this.channelName, callback);
    }

    sendScriptSpawned(info) {
        this.window.webContents.send('channel-script-spawn-' + this.channelName, info);
    }

    /**
     *
     * @param {TerminalTextLogMessage} message
     */
    sendMessage(message) {
        console.log(`[Channel] webContents ${'channel-serialized-message-' + this.channelName} send message`, message.serialize())
        this.window.webContents.send('channel-serialized-message-' + this.channelName, message.serialize());
        console.log(`[Channel] webContents ${'channel-serialized-message-' + this.channelName} send message success`)
    }
}

export class ConversationHandler {
    constructor(window) {
        this.window = window;
        this.conversations = [];
        ipcMain.on('create-channel', (event, channelId) => {
            this.addConversation(channelId);
        });
    }

    createConversation(channelName) {
        return {
            channel: new Channel(this.window, channelName),
            commandProcessor: new CommandProcessor(channelName),
            terminalInterface: new TerminalInterface(80, 30, 50),
            messageLog: new Log(),
            channelName: channelName,
            contextManager: new ContextManager()
        };
    }

    sendInputCallback(conversation, text, options={password: false}) {
        console.log(`[ConversationHandler] >>> channel ${conversation.channel.channelName} send to child`, JSON.stringify(text))
        conversation.contextManager.bufferInput(text, (text)=>{conversation.commandProcessor.sendToChild(text);});

        const message = TerminalTextLogMessage.createMessageWithCurrentTime(text, TextClass.INPUT, true, options.password);
        conversation.messageLog.log(message);
        conversation.channel.sendMessage(message);
    }

    sendCommandCallback(conversation, text) {
        console.log(`[ConversationHandler] channel ${conversation.channel.channelName} send command`, text)
        const message = TerminalCommandLogMessage.createTimedCommandMessage(text);
        conversation.commandProcessor.createChildProcess(message);
        conversation.contextManager.bufferInput(text, ()=>{});

        conversation.messageLog.log(message);
        conversation.channel.sendMessage(message);
    }

    sendSignalCallback(conversation, signal) {
        conversation.commandProcessor.killChildProcess(signal);
        const message = TerminalTextLogMessage.createMessageWithCurrentTime(signal, TextClass.SIGNAL, false, false);
        conversation.messageLog.log(message);
        conversation.channel.sendMessage(message);
    }



    createProcessOutputData(conversation) {
        return {
            channelName: conversation.channelName,
            createAnsiOutputStream: (childProcessOutput) => {
                const {stream: ansiOutputStream} = conversation.terminalInterface.parseRawOutput(childProcessOutput.text || "");
                return ansiOutputStream;
            },
            callback: (childProcessOutput) => {
                console.log(`[ConversationHandler] Conversation ${conversation.channelName} Received output data`, JSON.stringify(childProcessOutput))
                if (childProcessOutput.args && childProcessOutput.args.command === "!open") {
                    const fileTypeInfo = FileType.fileTypeFromFile(childProcessOutput.args.localPath);
                    console.log(`[ConversationHandler] Conversation ${conversation.channelName} Received output data ${childProcessOutput.args.localPath} with fileTypeInfo`, fileTypeInfo)
                    shell.openPath(childProcessOutput.args.localPath);
                    fs.readFile(childProcessOutput.args.localPath, async (err, data) => {
                        if (err) {
                            console.error(err);
                            return;
                        }
                        if (fileTypeInfo && (fileTypeInfo.mime.startsWith("text") || fileTypeInfo.mime.startsWith("plain/text"))) {  // weird example in docs
                            const text = data.toString();
                            const message = TerminalTextLogMessage.createMessageWithCurrentTime(text, TextClass.FILE, false, false, fileTypeInfo);
                            conversation.messageLog.log(message);
                            conversation.channel.sendMessage(message);
                        } else {
                            const base64 = data.toString('base64');
                            const message = TerminalTextLogMessage.createMessageWithCurrentTime(base64, TextClass.FILE, false, false, fileTypeInfo);
                            conversation.messageLog.log(message);
                            conversation.channel.sendMessage(message);
                        }
                    });
                } else {
                    const ansiOutputStream = childProcessOutput.text;
                    const endStream = childProcessOutput.end;
                    const message = TerminalTextLogMessage.createOutputMessageWithCurrentTime(childProcessOutput, ansiOutputStream, endStream);
                    conversation.messageLog.log(message);
                    conversation.channel.sendMessage(message);
                }
            }
        };
    }

    addConversation(channelName) {
        console.log("[ConversationHandler] Received channel creation", channelName);
        const conversation = this.createConversation(channelName);
        conversation.channel.onSendInput((text, options={password: false}) => {
            this.sendInputCallback(conversation, text, options);
        })

        conversation.channel.onSendCommand((text) => {
            this.sendCommandCallback(conversation, text);
        })

        conversation.channel.onSendSignal((signal) => {
            this.sendCommandCallback(conversation, signal);
        })

        conversation.contextManager.onStdout((childProcessOutput) => {

        });

        const processOutputData = this.createProcessOutputData(conversation);

        conversation.commandProcessor.connectSignals({
            onSpawnedCallback: () => conversation.channel.sendScriptSpawned(new Date()),
            onStdoutCallback: (childProcessOutput) => {
                console.log(`[ConversationHandler] Conversation ${conversation.channelName} callback onStdout with connectSignals`,)
                console.log(`[ConversationHandler] Conversation ${conversation.channelName} has processOutputData`, processOutputData.channelName)
                const ansiOutputStream = processOutputData.createAnsiOutputStream(childProcessOutput);
                conversation.contextManager.receiveOutputFromChildProcess(ansiOutputStream);
            },
            onStderrCallback: (childProcessOutput) => processOutputData.callback(childProcessOutput),
            onExitCallback: (exitCode) => {
                const message = TerminalTextLogMessage.createMessageWithCurrentTime(exitCode, TextClass.EXITCODE, false, false);
                conversation.messageLog.log(message);
                conversation.channel.sendMessage(message);
            },
            onStdinCallback: null
        });



        this.conversations.push(conversation);
    }


}
//
// module.exports = {ConversationHandler};