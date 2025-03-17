const { REST, Routes } = require('discord.js');
const { Client, Collection ,Events, GatewayIntentBits, Message, MessageCollector, MessageAttachment, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { blockQuote, bold, italic, quote, spoiler, strikethrough, underline, subtext } = require('discord.js');
const { clientId, guildId, token, osu_token, osu_channel} = require('./config.json');
let { osu_userId, osu_userRankNum, osu_userRankPP } = require('./data.json');
const fs = require('fs');
const path = require('path');

// MAX_API_COUNTER = 분당 최대 API 요청 횟수
// 비트맵 정보 제공 API는 포함되지 않았으므로, API 횟수 제한을 초과할 위험성이 존재함
let MAX_API_COUNTER = 50;
let CURRENT_API_COUNTER = 0;
let DEFAULT_RANKNUM = "50";
let OBSERVING_AVAILABLE = false;
let IS_USERBESTPP_UPDATED = false;

const URL_get_beatmap = `https://osu.ppy.sh/api/get_beatmaps?k=${osu_token}`;
const URL_get_user = `https://osu.ppy.sh/api/get_user?k=${osu_token}&u=userId`;
const URL_get_user_best = `https://osu.ppy.sh/api/get_user_best?k=${osu_token}&u=userId&limit=OSU_USERRANKNUM`;
const URL_get_user_recent = `https://osu.ppy.sh/api/get_user_recent?k=${osu_token}&u=userId&limit=30`;
const URL_get_scores = `https://osu.ppy.sh/api/get_scores?k=${osu_token}&b=beatmapId&u=userId`;

const Mods = {
    None: 0,
    NoFail: 1,
    Easy: 2,
    TouchDevice: 4,
    Hidden: 8,
    HardRock: 16,
    SuddenDeath: 32,
    DoubleTime: 64,
    Relax: 128,
    HalfTime: 256,
    Nightcore: 576,
    Flashlight: 1024,
    Autoplay: 2048,
    SpunOut: 4096,
    Relax2: 8192,
    Perfect: 16416,
    Key4: 32768,
    Key5: 65536,
    Key6: 131072,
    Key7: 262144,
    Key8: 524288,
    FadeIn: 1048576,
    Random: 2097152,
    Cinema: 4194304,
    Target: 8388608,
    Key9: 16777216,
    Key10: 33554432,
    Key1: 67108864,
    Key3: 134217728,
    Key2: 268435456,
    ScoreV2: 536870912,
    Mirror: 1073741824
};
                    
let SAVED_ACHIEVEMENTS = new Map();
const cooldowns = new Map();

const requestHeader_GET = {
    mothod: "GET",
    header: {
        "Accept" : "application / json",
        "Authorization" : `Bearer ${osu_token}`,
    },
};

const OSU_SITE = /^https:\/\/osu\.ppy\.sh\/beatmapsets\/(\d+)|((\d+)#osu\/(\d+)|(\d+)\/download(\?noVideo\=1)?)$/;
const FIRST_NUM = /\d+/g;

// 새로운 client instance 생성
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
] });

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// client가 준비상태일때, 아래 코드를 실행
client.once(Events.ClientReady, c => {
    //console.log(`Get Ready! Logged in as ${c.user.tag}`);
    console.log(`아리스 봇!, 구동되었습니다!`);

});

// 슬래쉬 ('/') 명령어 추가 코드

const commands = [];

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] ${filePath} 해당 커맨드 파일에는 "data" 또는 "execute" 프로퍼티를 찾을 수 없습니다.`);
    }
}


// Rest 호출
const rest = new REST().setToken(token);

client.on('ready', async () => { 
    // guildId = 슬래시 명령어를 등록할 서버 ID
    const guild = client.guilds.cache.get(guildId);

    try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		)
        .then(() => console.log('Successfully registered application commands.'))
        .catch(console.error);

		//console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}


    console.log('command registered!');
});

client.on('interactionCreate', async interaction =>{
    // 자동 완성 기능 (Auto Complete)
    if (interaction.isAutocomplete()){

        if (interaction.commandName == '유저_정보'){
            console.log("유저_정보 자동완성 확인");
        
            let osuUsers = Object.keys(osu_userId);

            const focusedValue = interaction.options.getFocused();
            // 입력값과 부분적으로 일치하는 유저명 필터링
            

            const filtered = osuUsers.filter(osuUsers => osuUsers.toLowerCase().startsWith(focusedValue.toLowerCase()));


            // 추천 목록을 응답으로 보냄
            await interaction.respond(filtered.map(osuUsers => ({ name: osuUsers, value: osuUsers })),);
        }
    }
});


// 슬래쉬 ('/') 명령어 응답 코드
client.on('interactionCreate', async interaction =>{
    if (!interaction.isCommand()) return;

    
    // 메시지 읽는 코드
    // console.log(`[${message.guild.name}] ${message.author.tag}: ${message.content}`);

    // 메시지 제한 코드
    ////////////////////////////////////////////
    const requestUserId = interaction.user.id;
    const now = Date.now();
    const timeWindow = 60000; // 1분 (60,000ms)
    const maxRequests = 5; // 5회 이상 제한
    const blockDuration = 30000; // 30초 동안 차단


    if (!cooldowns.has(requestUserId)) {
        cooldowns.set(requestUserId, { timestamps: [], blockedUntil: 0 });
    }

    const userData = cooldowns.get(requestUserId);

    // 차단 시간 확인
    if (now < userData.blockedUntil || CURRENT_API_COUNTER > MAX_API_COUNTER) {
        await interaction.reply({ files: [{ attachment: './src/blue_screen_aris.jpg' }] });
        await interaction.reply("요청을 너무 많아 받아 봇이 디졌습니다.");
        return;
    }

    // 현재 시간 기준 1분 내 요청만 필터링
    userData.timestamps = userData.timestamps.filter(ts => now - ts < timeWindow);
    
    if (userData.timestamps.length >= maxRequests) {
        userData.blockedUntil = now + blockDuration; // 차단 설정
        await interaction.reply({ files: [{ attachment: './src/blue_screen_aris2.jpg' }] });
        await interaction.reply("너무 많은 요청을 보냈습니다! 30초 후 다시 시도하세요.");
        return;
    }

    // 요청 기록 추가
    userData.timestamps.push(now);

    const commandName = interaction.commandName;
    let username, userId, rankNum, rankPP;
    switch (commandName) {

        case '실시간모드':
            await reloadData();
            if (!IS_USERBESTPP_UPDATED){
                await reloadData();
                registeredUsers = [];
                // osu_userRankNum에 존재하는 내부 객체 갯수만큼 반복
                Object.entries(osu_userId).forEach(([username, userId]) => {
                    console.log(`유저 ${username}를 등록합니다.`);
                    updateUserRankALL(username, userId);
                    registeredUsers.push(`${username} `);
                });
                const resultEmbed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle(`osu! 실시간 감지 유저 정보`)
                    .setDescription(`osu! 실시간 감지 유저 정보`)
                    .setImage('https://images7.alphacoders.com/136/1369318.png')
                    .addFields(
                        {   
                            name: `등록된 유저` , value: `${registeredUsers}`
                        },
                    );
                await interaction.reply({ embeds: [resultEmbed] });
                IS_USERBESTPP_UPDATED = true;
            }
            if (!OBSERVING_AVAILABLE){
                OBSERVING_AVAILABLE = !OBSERVING_AVAILABLE;
                observePPChange();
            }
            else {
                OBSERVING_AVAILABLE = !OBSERVING_AVAILABLE;
                await interaction.reply('실시간 모드 꺼짐');
            }
            break;

        case '유저_정보':
            await reloadData();
            
            if (!IS_USERBESTPP_UPDATED){
                await interaction.reply('/실시간모드 명령어를 우선적으로 실행하세요.')
                break;
            }
            username = interaction.options.getString('user');
            userId = osu_userId[username];
            rankNum = osu_userRankNum[username];
            rankPP = osu_userRankPP[userId];
            osuUsers = Object.keys(osu_userId);
            
            let userInfoEmbed = new EmbedBuilder()
                .setColor(0x0099ff) // 임베드 바 색깔
                .setTitle('오류 발생')
                .setImage('https://i.imgur.com/TfBPbos.png')
                .setDescription(`유저를 찾을 수 없음`);
            if (osuUsers.includes(username)) {
                userInfoEmbed = new EmbedBuilder()
                .setColor(0x0099ff) // 임베드 바 색깔
                    .setTitle(`osu! 실시간 감지 유저 정보`)
                    .setDescription(`osu! 실시간 감지 유저 정보`)
                    .setImage('https://i.imgur.com/TfBPbos.png')
                    .addFields(
                        {   
                            name: `${username}님의 정보` , value: `최고기록 ${rankNum}등 이내의 기록(${rankPP}pp) 감지중`
                        },
                    );
            }
            await interaction.reply({ embeds: [userInfoEmbed] });
            break;
        
        // case '유저_등록':
        //     break;

        case 'ping':
            await interaction.reply('Pong!');
            break;
        case 'server':
            await interaction.reply(`서버명 : ${interaction.guild.name}.\n총 멤버수 : ${interaction.guild.memberCount}.`);
            break;
        case 'user':
            await interaction.reply(`당신의 이름 : ${interaction.user.username}.\n당신의 태그 : ${interaction.user.tag}.\n당신의 id : ${interaction.user.id}.`);
            break;
        default:
            await interaction.reply("올바르지 않은 명령어입니다.");
            break;
    }
});

//osu 맵 정보 인식 및 Map Number 추출, 맵 정보 출력 코드
client.on('messageCreate', async message => {
    if (message.author.bot) return; // 봇 메시지는 무시 

    // 메시지 제한 코드
    const requestUserId = message.author.id;
    const now = Date.now();
    const timeWindow = 60000; // 1분 (60,000ms)
    const maxRequests = 20; // 20회 이상 제한
    const blockDuration = 30000; // 30초 동안 차단

    if (!cooldowns.has(requestUserId)) {
        cooldowns.set(requestUserId, { timestamps: [], blockedUntil: 0 });
        console.log ("새로운 유저가 입력함. timestamp 기록 시작");
    }

    const userData = cooldowns.get(requestUserId);



    
    if (message.content.match(OSU_SITE)){
        console.log ("osu 사이트 확인됨.");

        // 차단 시간 확인
        if (now < userData.blockedUntil || CURRENT_API_COUNTER > MAX_API_COUNTER) {
            await interaction.reply({ files: [{ attachment: './src/blue_screen_aris.jpg' }] });
            await interaction.reply("요청을 너무 많아 받아 봇이 디졌습니다.");
            return;
        }


        // 현재 시간 기준 1분 내 요청만 필터링
        userData.timestamps = userData.timestamps.filter(ts => now - ts < timeWindow);
        console.log(`userData.timestamps.length : ${userData.timestamps.length}`);
        console.log(`maxRequests : ${maxRequests}`);
        
        if ((userData.timestamps.length >= maxRequests)) {
            userData.blockedUntil = now + blockDuration; // 차단 설정
            message.channel.send({ files: [{ attachment: './src/blue_screen_aris2.jpg' }] });
            message.channel.send("너무 많은 요청을 보냈습니다! 30초 후 다시 시도하세요.");
            return;
        }
            

        // 요청 기록 추가
        userData.timestamps.push(now);


        let beatmapinfoEmbed;

        const map_num = message.content.match(FIRST_NUM);
        const beatmapsetId = map_num[0]; 
        let beatmapId;
        if (map_num.length > 1){
            beatmapId = map_num[1];
        }

        fetch(URL_get_beatmap.concat(`&s=${beatmapsetId}`), requestHeader_GET)
            .then(response => {
                CURRENT_API_COUNTER++;
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then (data => {
                // 데이터를 정상적으로 받아옴
                console.log("데이터 받음");

                // 데이터를 받아오면, Example Embed 구성함
                beatmapinfoEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Some title')
                    .setURL('https://osu.ppy.sh/')
                    .setDescription('Some description here')
                    .setTimestamp();

                // 난이도 순으로 정렬
                data.sort((a, b) => a.difficultyrating - b.difficultyrating);
                
                // standard외 다른 모드 제거
                data = data.filter(item => item.mode =! 0)
                
                //console.log(data);
                
                // 난이도 갯수 Count
                let diffRatings = data.map(beatmap => parseFloat(beatmap.difficultyrating));
                let numberOfDiff = diffRatings.length;


                // 맵 제목, 제작자 addFields
                beatmapinfoEmbed.addFields(
                    { name: '\u200B', value: '\u200B' },
                    { name: data[0].title , value: 'by '+ data[0].artist },
                    { name: '\u200B', value: '\u200B' },
                )
                
                let toolonginfo = "";

                if (numberOfDiff > 20){
                   toolonginfo = "\n 비트맵이 너무 많아서 3성 이상, 8성 이하로 축약함.";
                   diffRatings = diffRatings.filter(num => num >= 3 && num <= 8);
                   numberOfDiff = diffRatings.length;
                   if (numberOfDiff > 20) {
                        let beatmapAmount = numberOfDiff;
                        numberOfDiff = 20;
                        toolonginfo = `\n비트맵이 너무 많아서 3성 이상, 8성 이하로 축약함.\n근데 축약해도 너무 많아서 ${beatmapAmount-20}개 짤림...`;
                   }
                }

                // 각각의 난이도 addFields, 난이도 , pp 계산
                for (let i=0; i<numberOfDiff; i++){
                    let starRating = parseFloat(diffRatings[i]);
 
                    // pp 계산 구현 실패

                    // let totalLength = parseInt(data[i].total_length);
                    // let noteCount = parseInt(data[i].count_normal) + parseInt(data[i].count_slider) + parseInt(data[i].count_spinner);

                    // //let rawPP = calculateRawPP(starRating, totalLength, noteCount)
                    // let rawPP = NaN;
                    
                    beatmapinfoEmbed.addFields(
                        //{ name: data[i].version+"\nby "+data[i].creator, value: starRating.toFixed(2)+'★\n(SS) '+ rawPP + ' pp' , inline: true }
                        { name: data[i].version+"\nby "+data[i].creator, value: starRating.toFixed(2)+'★\n ', inline: true }
                    )
                }

                // 전체적인 beatmap 정보 메시지로 출력 (Embeds로 출력함)
                message.channel.send({ embeds: [
                    beatmapinfoEmbed
                        .setTitle(data[0].title+"\n < osu! beatmap info > ")
                        .setURL(`https://osu.ppy.sh/beatmapsets/${beatmapsetId}#osu/${beatmapId}`)
                        .setDescription("legnth - " + parseInt(data[0].total_length/60) + ":" + data[0].total_length%60 + toolonginfo)
                        .setImage(`https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/cover.jpg`)
                        .setThumbnail(`https://b.ppy.sh/thumb/${beatmapsetId}.jpg`)
                        .setTimestamp()
                ] });

            })
            .catch(error => {
                console.error('Error:', error);
            });
    }
});




async function reloadData() {
    try {
        const data = fs.readFileSync('./data.json');
        const parsedData = JSON.parse(data);
        
        // 전역 변수 업데이트
        osu_userId = parsedData.osu_userId;
        osu_userRankNum = parsedData.osu_userRankNum;
        osu_userRankPP = parsedData.osu_userRankPP;

    } catch (err) {
        console.error('Error reading JSON file:', err);
    }
}


async function observePPChange(){
    let counter = 0;
    console.log("Observing Activated");

    while (OBSERVING_AVAILABLE){
        for (const [name, userId] of Object.entries(osu_userId)) {
            console.log(`유저명: ${name} 의 기록을 관찰함. 유저 ID: ${userId}`);
            compareUserRecent(userId);
            console.log(`CURRENT_API_COUNTER : ${CURRENT_API_COUNTER}`);
            // 차단 시간 확인
            if (CURRENT_API_COUNTER > MAX_API_COUNTER) {
                await interaction.reply({ files: [{ attachment: './src/blue_screen_aris.jpg' }] });
                await interaction.reply("API 부하가 걸려 봇이 디졋ㅅ습ㄴㅣ다.\n30초만 기달려주새요");
                await wait(30000) // 30초 대기
            }
            await wait(5000); // 5초 대기
        }
        CURRENT_API_COUNTER = 0;
    }
    console.log("Observing Inactivated");
}


// 테스트용 코드, 메시지만 받으면 바로 구동됨
client.on('messageCreate', message => {
    if (message.author.bot) return; // 봇 메시지는 무시
    // if (message.content.match("test")){
    //     for (const [name, userId] of Object.entries(osu_userId)) {
    //         console.log(`유저명: ${name}, 유저 ID: ${userId}`);
    //         updateUserBestPP(userId);
    //         message.reply(`유저: ${name} 의 pp가 업데이트 되었습니다!.`);
    //     }
    if (message.content.match("CHECK MEMORY")){
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`약 ${Math.round(used * 100) / 100} MB의 메모리를 사용중입니다.`);
    }
})

async function updateUserRankALL(username, userId) {
    let top_N_PP = await getUserBestPP(userId, DEFAULT_RANKNUM);
    console.log (`top ${osu_userRankNum[username]} PP : ` + top_N_PP);
        
    data = JSON.parse(fs.readFileSync('./data.json'));

    data.osu_userRankNum[username] = DEFAULT_RANKNUM;
    data.osu_userRankPP[userId] = top_N_PP;
    fs.writeFile('./data.json', JSON.stringify(data, null, 4),  'utf8', (err) => {
        if (err) {
            console.error("파일을 저장하는 중 오류 발생:", err);
            return;
        }
        console.log(`${username}의 등록이 완료되었습니다!`);
    })
}

async function getBeatmapData(beatmapId, mods) {
    try {
        const response = await fetch(URL_get_beatmap.concat(`&b=${beatmapId}&mods=${mods}`), requestHeader_GET);
        CURRENT_API_COUNTER++;
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }


        const pureData = await response.json();

        const data =  pureData.map(({ 
            beatmap_id, beatmapset_id, title, artist, bpm, difficultyrating, 
            version, creator, max_combo, total_length
        }) => ({
            beatmap_id, beatmapset_id, title, artist, bpm, difficultyrating, 
            version, creator, max_combo, total_length
        }));
        
        return data;
    }
    catch (error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

async function getUserBestPP(userId, rankNum){
    try {
        // 항상 최고기록 50개를 집계함
        const response = await fetch(URL_get_user_best.replace("userId",userId).replace("OSU_USERRANKNUM",50), requestHeader_GET);
        CURRENT_API_COUNTER++;
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        // console.log("data :\n"+JSON.stringify(data, null, 4));

        return data[rankNum-1].pp;
        
    } catch(error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

async function getUserTop50All(userId){
    try {
        // 항상 최고기록 50개를 집계함
        const response = await fetch(URL_get_user_best.replace("userId",userId).replace("OSU_USERRANKNUM",50), requestHeader_GET);
        CURRENT_API_COUNTER++;
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const pureData = await response.json();

        const data =  pureData.map(({
            beatmap_id, score_id, count300, count100, count50, countmiss, 
            maxcombo, enabled_mods, rank, pp 
        }) => ({
            beatmap_id, score_id, count300, count100, count50, countmiss, 
            maxcombo, enabled_mods, rank, pp
        }));

        return data;
        
    } catch(error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

// 최근 기록 5개를 수집하여, pp를 수집하고 최고 50등의 pp보다 높으면 알림을 주는 기능
// 최근 기록 5개를 저장하기 위한 SAVED_ACHIEVEMENTS와 비교해서 중복값이 존재하면 바로 함수 종료
async function compareUserRecent(userId){
    try {

        // [ {beatmap_id, user_id, score_id} ]
        let recentScores = await getUserRecent(userId);

        // TOP 50의 모든
        // beatmap_id, score_id, count300, count100, count50, countmiss, 
        // maxcombo, enabled_mods, rank, pp
        const user_Top50Score = await getUserTop50All(userId);

        // 최근 기록이 갱신되지 않았으면, 종료시킴
        if (recentScores.length < 1){
            console.log('최근 기록이 갱신되지 않음.');
            return;
        }
        // 최근 5개의 기록중 밑에서부터 하나씩 기록 조사
        for (let i=0; i<recentScores.length; i++){
            console.log(`recent score id : ${recentScores[i].score_id}`);
            
            // 중복 검사 구간
            // 기록 조사를 처음부터 한다면, SAVED_ACHIEVEMENTS에 userId에 해당되는 새로운 배열을 생성
            if (!SAVED_ACHIEVEMENTS.has(userId)) {
                SAVED_ACHIEVEMENTS.set(userId, []);  // userId에 대한 배열을 초기화
            }
            // 중복 검사, 만약 중복되는 경우가 있다면 getAchievements 작업을 종료함
            if (SAVED_ACHIEVEMENTS.get(userId).includes(recentScores[i].score_id)) {
                console.log("중복 자료 발견함 종료.");
                break;
            }
            SAVED_ACHIEVEMENTS.get(userId).push(recentScores[i].score_id);    
            
    
            
            
            // data.json 에서 가져온 설정된 50위 pp를 가져옴
            await reloadData();
            let rankPP = osu_userRankPP[userId];

            // 내 최고 50위 순위권 내에 존재하는 score인 경우, pp 기록을 갱신한 경우로 확인
            
            const newRecordIndex = user_Top50Score.findIndex(item => item.score_id === recentScores[i].score_id);
            if (newRecordIndex !== -1){
                const newRecordData = user_Top50Score[newRecordIndex];
                const username = Object.entries(osu_userId).find(([name, id]) => id === userId)?.[0];

                
                
                let accuracy = checkAccuracy(newRecordData.count300, newRecordData.count100, newRecordData.count50, newRecordData.countmiss);
                
                // 위 기록과 연관된 비트맵 관련 정보도 다 뽑아버림
                // beatmap_id, beatmapset_id, title, artist, bpm, difficultyrating,
                // version, creator, max_combo, total_length
                const filteredBeatmapData = await getBeatmapData(newRecordData.beatmap_id,newRecordData.enabled_mods);
                const beatmapData = filteredBeatmapData[0];

                let newRecord = [beatmapData.beatmap_id, newRecordData.pp];
                console.log(`newRecord : ${newRecord}`);

                let updatedRank = newRecordIndex+1;

                const checkedMode = checkMods(newRecordData.enabled_mods);
                let checkedCombo = checkCombo(newRecordData.maxcombo, beatmapData.max_combo);
                if (checkedCombo == "FULL COMBO") checkedCombo = bold(checkedCombo);

                let resultEmbed = new EmbedBuilder()
                    .setColor(0x0099ff) // 임베드 바 색깔
                    .setTitle(`osu! 실시간 감지 유저 정보`)
                    .setDescription(`osu! 실시간 감지 유저 정보`)
                    .setImage(`https://assets.ppy.sh/beatmaps/${beatmapData.beatmapset_id}/covers/cover.jpg`)
                    .addFields(
                        
                        { name: '\u200B', value: '\u200B' },
                        { name: `osu! 기록 갱신 알림` , value: `${username}님이 ${updatedRank} 번째 최고기록이 갱신되었습니다!\n
                        획득 pp : ${bold(newRecordData.pp)}  |  ${osu_userRankNum[username]}위 pp : ${rankPP}` },
                        { name: '\u200B', value: '\u200B' },
                        { name: '달성한 맵 정보', value: `${beatmapData.title} - ${beatmapData.artist}` },
                        { name: `${beatmapData.version}`, value : `by ${beatmapData.creator} - ${(+beatmapData.difficultyrating).toFixed(2)}★`},
                        { name: '\u200B', value: '\u200B' },
                        { name: '달성한 맵 링크', value: `https://osu.ppy.sh/beatmapsets/${beatmapData.beatmapset_id}#osu/${beatmapData.beatmap_id}` },
                        { name: '\u200B', value: '\u200B' },
                        { name: `상세 점수`, value : `Rank : ${newRecordData.rank}   |   Accuracy : ${accuracy}%\nCOMBO : ${checkedCombo} \n Mods : ${checkedMode}\n
                        [300] : ${newRecordData.count300} | [100] : ${newRecordData.count100} | [50] : ${newRecordData.count50} | [miss] : ${newRecordData.countmiss}` }  
                    );
                //osu 맵 정보 인식 및 Map Number 추출, 맵 정보 출력 코드
                const channel = await client.channels.fetch(osu_channel);
                await channel.send({ embeds: [resultEmbed] });
            }
            // 반복되는 recent 데이터가 없는 경우, 데이터 검사 시행
        }
    }
    catch (error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

// 정확도 계산 함수
// (300 notes*300 + 100 notes*100 + 50 notes*50) / (ALL notes * 300)
function checkAccuracy(n300, n100, n50, n0){
    let nALL = n300 + n100 + n50 + n0;

    return ((n300*300 + n100*100 + n50*50) / (nALL * 300) * 100).toFixed(2);
}

// 모드 체크 함수
function checkMods (mods_num){
    let convertMods = Object.keys(Mods)
        .filter(mod => (mods_num & Mods[mod]) !== 0)
        .join(", ");
    return convertMods;
}

// 콤보 체크 함수
function checkCombo(userCombo, mapCombo){
    if (userCombo == mapCombo){
        return "FULL COMBO";
    }
    else {
        return `${userCombo} / ${mapCombo}`;
    }
}

// Recent Score중 score_id가 존재하는(클리어 책정이 된) 최근 10개의 기록만을 가져오는 함수
// [ {beatmap_id, user_id, score_id} ]
async function getUserRecent(userId){
    try {
        let response = await fetch(URL_get_user_recent.replace("userId",userId), requestHeader_GET);
        CURRENT_API_COUNTER++;
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        let data = await response.json();

        data = data
        .filter(({ score_id }) => {
            return score_id !== null;
        })

        let getScores = data
            .slice(0, 5)
            .map(({ beatmap_id, user_id, score_id }) => ({ beatmap_id, user_id, score_id }));

        return getScores;

    } catch (error){
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

// 클라이언트의 토큰을 이용하여 디스코드에 로그인
client.login(token);