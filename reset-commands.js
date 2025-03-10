// 슬래쉬 ('/') 명령어 추가 코드
const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
	try {
        console.log('Deleting all global commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('Successfully deleted all global commands.');
    } catch (error) {
        console.error(error);
    }
})();
