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
import {CommandProcessor} from './command_processor.js';
import {TerminalInterface} from './terminal_interface.js';
import * as fs from 'fs';
import * as FileType from 'file-type';
import isBinaryPath from 'is-binary-path';
import {Log} from '../shared/message_log.js';
import {TextClass} from '../shared/text_class.js';
import {TerminalCommandLogMessage, TerminalTextLogMessage} from '../shared/message.js';
import mime from 'mime-types';
import {ChildProcessOutput} from "./child_process_output.js";
import {OutputEvent} from "./x_corresponding_output_manager.js";

const {ipcMain, shell} = await import ('electron');


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
     * Send message from Backend to Frontend.
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
        const processor = {
            channelName: conversation.channelName,
            createAnsiOutputStream: (childProcessOutput) => {
                const {stream: ansiOutputStream} = conversation.terminalInterface.parseRawOutput(childProcessOutput.text || "");
                return ansiOutputStream;
            },
            /**
             * Parse the raw childProcessOutput with ANSI and Wrap into an OutputEvent.
             * @param {ChildProcessOutput} childProcessOutput
             * @returns {OutputEvent}
             */
            processRawOutput: (childProcessOutput) => {
                if (childProcessOutput.end !== undefined) {
                    console.log(`[ConversationHandler] Conversation ${conversation.channelName} Received output data with end`, JSON.stringify(childProcessOutput));
                    throw new Error("Received output data with end");
                }
                const ansiOutputStream = processor.createAnsiOutputStream(childProcessOutput);
                return new OutputEvent(childProcessOutput.text, ansiOutputStream);
            },
            callback: (message) => {
                console.log(`[ConversationHandler] Conversation ${conversation.channelName} Received output data`, JSON.stringify(message))
                if (message.args && message.args.command === "!open") {
                    const isBinary = isBinaryPath(message.args.localPath);
                    const fileTypeInfoPromise = FileType.fileTypeFromFile(message.args.localPath).then((fileTypeInfo) => {
                        console.log(`[ConversationHandler] Conversation ${conversation.channelName} Received output data ${message.args.localPath} with fileTypeInfo`, fileTypeInfo)
                    });
                    const fileSize = fs.statSync(message.args.localPath).size;
                    if (fileSize > 4 * 1024 * 1024) {  // 4MB
                        // open the local path folder
                        shell.showItemInFolder(message.args.localPath);

                    }
                    else {
                        shell.showItemInFolder(message.args.localPath);
                        fs.readFile(message.args.localPath, async (err, data) => {
                            if (err) {
                                console.error(err);
                                return;
                            }
                            const fileTypeInfoFromFileType = await fileTypeInfoPromise;
                            const mimeFileType = mime.lookup(message.args.localPath);
                            const fileTypeInfo = (fileTypeInfoFromFileType && fileTypeInfoFromFileType.mime) ? fileTypeInfoFromFileType.mime : mimeFileType;
                            console.log(`[ConversationHandler] readFile.getFileTypeInfo ${message.args.localPath} with fileTypeInfo`, fileTypeInfoFromFileType, mimeFileType)
                            if (!isBinary && fileSize < 1024 * 1024) {  // 1MB text

                                const text = data.toString();
                                const _message = TerminalTextLogMessage.createMessageWithCurrentTime(text, TextClass.FILE, false, false, {path: message.args.localPath,
                                    remotePath: message.args.remotePath,
                                    fileType: fileTypeInfo});
                                conversation.messageLog.log(_message);
                                conversation.channel.sendMessage(_message);
                            } else {
                                if (fileTypeInfo && fileTypeInfo.startsWith("image")) {
                                    shell.openPath(message.args.localPath).then(()=>{});
                                }
                                const base64 = data.toString('base64');
                                const _message = TerminalTextLogMessage.createMessageWithCurrentTime(base64, TextClass.FILE, false, false, {path: message.args.localPath,
                                    remotePath: message.args.remotePath,
                                    fileType: fileTypeInfo});
                                conversation.messageLog.log(_message);
                                conversation.channel.sendMessage(_message);
                            }
                        } );
                    }

                } else {
                    conversation.messageLog.log(message);
                    conversation.channel.sendMessage(message);
                }
            }
        };
        return processor;
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

        conversation.contextManager.onStdout((message) => {
            processOutputData.callback(message);
        });

        const processOutputData = this.createProcessOutputData(conversation);

        conversation.commandProcessor.connectSignals({
            onSpawnedCallback: () => conversation.channel.sendScriptSpawned(new Date()),
            onStdoutCallback: (childProcessOutput) => {
                console.log(`[ConversationHandler] Conversation ${conversation.channelName} callback onStdout with connectSignals`,)
                console.log(`[ConversationHandler] Conversation ${conversation.channelName} has processOutputData`, processOutputData.channelName);

                conversation.contextManager.receiveOutputFromChildProcess(processOutputData.processRawOutput(childProcessOutput));
            },
            onStderrCallback: (message) => processOutputData.callback(message),
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