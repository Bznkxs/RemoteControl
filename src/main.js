const { app, BrowserWindow } = await import ('electron');
const path = await import ('node:path');
const {started} = await import ('electron-squirrel-startup');
const {ipcMain} = await import ('electron');
const {ConversationHandler} = await import ("./backend/conversation_handler.js");
const fs = await import ('fs');
const {OpenAIChatStudentExpertPair} = await import ("./backend/chatgpt.js");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}


const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(process.cwd(), 'src', 'preload.js')
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(path.join(process.cwd(),'src','frontend', 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
  //
  const conversationHandler = new ConversationHandler(mainWindow);

    ipcMain.on("create-chatgpt", (event, configPath, problemText) => {

        const chat = new OpenAIChatStudentExpertPair(configPath, (message) => {
            mainWindow.webContents.send('chatgpt-send-message', message);
        });
        chat.startChat(problemText);

    });

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
//
// const {Command} = require ("./backend/command");
// const {CommandPTY} = require ("./backend/command_pty");
//
// let command;
// ipcMain.on("change-command", (event, arg) => {
//     console.log(`Changing command to ${arg}`);
//     if (command) {
//         command.destroy();
//     }
//     if (arg === "default") {
//         command = new Command();
//     } else if (arg === "pty") {
//         command = new CommandPTY();
//     }
//     // list listener of ipcMain signal 'run-script'
//     // console.log("Listeners of 'run-script':")
//     // ipcMain.listeners('run-script').forEach((listener) => {
//     //     console.log(listener);
//     // });
// });
//
//
// const { getAnsiTerminalInfo, getSimpleTerminalInfo } = require('./backend_terminal_parsing');
//
//
// ipcMain.on("get-ansi-terminal", (event, data) => {
//     // console.log(`Parsing ANSI data`);
//     event.returnValue = getAnsiTerminalInfo(command, data);
// });
//
// ipcMain.on("get-simple-terminal", (event, data) => {
//     event.returnValue = getSimpleTerminalInfo(data);
// });


ipcMain.on("read-file", (event, path) => {

    // console.log(process.cwd());
    fs.readFile(path, 'utf8', (err, data) => {
        if (err) {
            console.log("Error reading file", err);
            event.returnValue = err;
        } else {
            console.log("Read file", data);
            event.returnValue = data;
        }
    })
});

