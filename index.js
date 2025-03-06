const { REST, Routes } = require('discord.js');
const { Client, Collection ,Events, GatewayIntentBits, Message, MessageCollector, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { clientId, guildId, token, osu_token} = require('./config.json');
const { osu_userId, osu_userRankNum, osu_userRankPP } = require('./data.json');
const fs = require('fs');
const path = require('path');

// OSU_USERRANKNUM = 1 ~ 50

// 분당 최대 API 요청 횟수
// 비트맵 정보 제공 API는 포함되지 않았으므로, API 횟수 제한을 초과할 위험성이 존재함
let MAX_API_COUNTER = 40;
let CURRENT_API_COUNTER = 0;

let OBSERVING_AVAILABLE = false;
let IS_USERBESTPP_UPDATED = false;

const URL_get_beatmap = `https://osu.ppy.sh/api/get_beatmaps?k=${osu_token}&s=beatmapsetId`;
const URL_get_user = `https://osu.ppy.sh/api/get_user?k=${osu_token}&u=userId`;
const URL_get_user_best = `https://osu.ppy.sh/api/get_user_best?k=${osu_token}&u=userId&limit=OSU_USERRANKNUM`;
const URL_get_user_recent = `https://osu.ppy.sh/api/get_user_recent?k=${osu_token}&u=userId`;
const URL_get_scores = `https://osu.ppy.sh/api/get_scores?k=${osu_token}&b=beatmapId&u=userId`;

let exampleEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Some title')
                    .setURL('https://osu.ppy.sh/')
                    .setDescription('Some description here')
                    .setThumbnail('https://i.imgur.com/TfBPbos.png')
                    .setTimestamp()

let SAVED_ACHIEVEMENTS = new Map();
let TOP50_PP_MAP = new Map();

const requestHeader_GET = {
    mothod: "GET",
    header: {
        "Accept" : "application / json",
        "Authorization" : `Bearer ${osu_token}`,
    },
};

const OSU_SITE = /^https:\/\/osu\.ppy\.sh\/beatmapsets\/(\d+)|((\d+)#osu\/(\d+)|(\d+)\/download(\?noVideo\=1)?)$/;
const FIRST_NUM = /\d+/;

// 새로운 client instance 생성
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
] });



// client가 준비상태일때, 아래 코드를 실행
client.once(Events.ClientReady, c => {
    console.log(`Get Ready! Logged in as ${c.user.tag}`);
    console.log(`안녕하세요! 디코 봇, 구동되었습니다!`);

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
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
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


// 슬래쉬 ('/') 명령어 응답 코드
client.on('interactionCreate', async interaction =>{
    if (!interaction.isCommand()) return;
    
    // 메시지 읽는 코드
    // console.log(`[${message.guild.name}] ${message.author.tag}: ${message.content}`);

    const commandName = interaction.commandName;
    let username, rankNum, rankPP, userId;
    console.log(commandName);
    switch (commandName) {
        case '실시간모드':
            if (!IS_USERBESTPP_UPDATED){
                await interaction.reply('/유저_등록 명령어를 우선적으로 실행하세요.')
                break;
            }
            if (!OBSERVING_AVAILABLE){
                OBSERVING_AVAILABLE = !OBSERVING_AVAILABLE;
                await interaction.reply('실시간 모드 켜짐');
                observePPChange();
            }
            else {
                OBSERVING_AVAILABLE = !OBSERVING_AVAILABLE;
                await interaction.reply('실시간 모드 꺼짐');
            }
            break;

        case '유저_등수등록':
            username = interaction.options.getString('user');
            rankNum = interaction.options.getNumber('rank_num')-1;
            userId = osu_userId[username];
            updateUserBestPP(userId, rankNum, 0);
            rankPP = osu_user
            await interaction.reply(`${username}님의 최고 성과 ${rankNum+1}등 이내의 기록(${rankPP}pp)을 실시간 모니터링 합니다.`);
            break;

        case '유저_pp등록':
            username = interaction.options.getString('user');
            rankPP = interaction.options.getNumber('rank_pp');
            userId = osu_userId[username];
            updateUserBestPP(userId, rankPP, 1);
            await interaction.reply(`${username}님의 최고 성과 ${rankNum+1}등 이내의 기록(${rankPP}pp)을 실시간 모니터링 합니다.`);
            break;

        case '유저_정보':
            username = interaction.options.getString('user');
            showUserStatus(username);
            break;

        case '유저_등록':
            IS_USERBESTPP_UPDATED = true;
            registeredUsers = [];
            Object.entries(osu_userRankNum).forEach(([username, rankNum]) => {
                console.log(`유저 ${username}의 설정된 기본 등수 : ${rankNum}`);
                updateUserBestPP(osu_userId[username], rankNum, 0);
                registeredUsers.push(username+" ");
            });
            const resultEmbed = new EmbedBuilder()
            .setColor(0x0099ff) // 임베드 바 색깔
            .setTitle(`osu! 실시간 감지 유저 정보`)
            .setDescription(`osu! 실시간 감지 유저 정보`)
            .addFields(
                {   
                    name: `등록된 유저` , value: `${registeredUsers}`
                },
            );
        
            await interaction.reply({ embeds: [resultEmbed] });
            break;

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
client.on('messageCreate', message => {
    if (message.author.bot) return; // 봇 메시지는 무시
    
    if (message.content.match(OSU_SITE)){
        console.log ("osu 사이트 확인됨.");

        const map_num = message.content.match(FIRST_NUM);
        const beatmapsetId = map_num[0];
        console.log ("osu 맵 번호는 : "+beatmapsetId);


        fetch(URL_get_beatmap.replace("beatmapsetId", beatmapsetId), requestHeader_GET)
            .then(response => {
                CURRENT_API_COUNTER++;
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then (data => {
                // 데이터를 정상적으로 받아옴

                // 데이터를 받아오면, Example Embed 구성함
                let beatmapinfoEmbed = exampleEmbed;

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
                

                // 각각의 난이도 addFields, 난이도 , pp 계산
                for (let i=0; i<numberOfDiff; i++){
                    let starRating = parseFloat(data[i].difficultyrating);
                    let totalLength = parseInt(data[i].total_length);
                    let noteCount = parseInt(data[i].count_normal) + parseInt(data[i].count_slider) + parseInt(data[i].count_spinner);

                    //let rawPP = calculateRawPP(starRating, totalLength, noteCount)
                    let rawPP = NaN;
                    
                    beatmapinfoEmbed.addFields(
                        { name: data[i].version+"\nby "+data[i].creator, value: starRating.toFixed(2)+'★\n(SS) '+ rawPP + ' pp' , inline: true }
                    )
                }

                // 전체적인 beatmap 정보 메시지로 출력 (Embeds로 출력함)
                message.channel.send({ embeds: [
                    beatmapinfoEmbed
                        .setTitle(data[0].title+"\n < osu! beatmap info > ")
                        .setURL(`https://osu.ppy.sh/beatmapsets/${beatmapsetId}`)
                        .setDescription("legnth - " + parseInt(data[0].total_length/60) + ":" + data[0].total_length%60)
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



// 봇이 켜지면서 동시에 등록된 유저들의 최고기록 (osu_userRankNum[username])등의 pp를 받아와서 저장함
// 이후, 지속적으로 유저들의 recent 기록을 n sec마다 확인
// -> recent 기록에서 확인된 pp....가 있으면 편한데 pp를 확인 못함 ㅅㅂ..
    // 이게 존나 문제임 tq 어카지
// 최고기록 (osu_userRankNum[username])등의 pp 이상의 pp를 먹은 기록이 생겼다면, 이를 알리고 최고기록 (osu_userRankNum[username])등의 pp를 다시 받아와서 저장함

// 해결 방법
// -> get_score에서 scoreId를 입력해서 가져오면 해당 맵에서 얻은 pp가 나오는 것을 확인
// user_recent에서 얻은 score의 scoreId를 가져가서 get_score에 userId랑 scoreId를 같이 query해서 score의 pp를 구하는 방식
// 하나의 recent 요청에 get_recent, get_score 2번의 api 요청이 사용됨
// 총 인원은 7명이므로, 한바퀴 확인하는데 14번의 api 요청이 사용됨
// 분당 60번의 횟수 제한이 존재하므로... 30초마다 14번 총 요청 횟수는 분당 28번으로 하는 것을 목표로 한다.




//osu 유저들 실시간 감시 및, 기록 갱신시 알림 코드


// ////////////////
// api 요청 횟수
///////////////////
//
// - updateUserBestPP ( 7 times )
// : 유저의 n등수의 pp를 요청받고 저장함 - api 요청 1회 수행
// 
// 총 7명의 pp를 등록하므로, 총 api 요청 횟수 7회

// - compareUserRecent ( 14 ~ 42 times )
// : 유저의 최근 기록을 요청, 기록함
// : 유저의 recent score를 요청 + score_id와 대조되는 beatmap을 요청 - api 요청 6회 수행
//
// 총 7명의 최근 기록을 요청, - 6 x 7 = 42회
// 중복되는 기록이 존재하는 경우, 추가적인 beatmap 요청을 중지하므로 최소 2 x 7 회로 줄어듬

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function observePPChange(){
    let counter = 0;
    console.log("Observing Activated");

    while (OBSERVING_AVAILABLE){
        for (const [name, userId] of Object.entries(osu_userId)) {
            console.log(`유저명: ${name}, 유저 ID: ${userId}`);
            compareUserRecent(userId);
            console.log(`최근 기록 관찰된 유저명: ${name}, 유저 ID: ${userId}`);
            await wait(10000); // 10초 대기
        }
    }
    console.log("Observing Inactivated");
}


// 실시간 기능 안넣고 수동으로 돌아가게끔 하는 테스트 코드
client.on('messageCreate', message => {
    if (message.author.bot) return; // 봇 메시지는 무시
    if (message.content.match("test")){
        for (const [name, userId] of Object.entries(osu_userId)) {
            console.log(`유저명: ${name}, 유저 ID: ${userId}`);
            updateUserBestPP(userId);
            message.reply(`유저: ${name} 의 pp가 업데이트 되었습니다!.`);
        }
        
    }
    if (message.content.match("update user best pp")){
        let userId = "9098416";
        updateUserBestPP(userId);
        userId = "13048674";
        updateUserBestPP(userId);
    }
    if (message.content.match("check score test")){
        checkScorePP();
    }

    if (message.content.match("recent")){
        userId = "9098416";
        compareUserRecent(userId);
    }
    if (message.content.match("check SAVED_ACHIEVEMENTS")){
        console.log(SAVED_ACHIEVEMENTS);
    }
    if (message.content.match("show beatmap")){
        let beatmapSetNum = "384772";
        showBeatmapInfo(beatmapSetNum);
    }
    
})

async function showUserStatus(username){
    let userId = osu_userId[username];
    let rankNum = osu_userRankNum[username];
    let rankPP = osu_userRankPP[userId];
    let osuUsers = Object.keys(osu_userId);
    if (osuUsers.includes(username)) {
        const resultEmbed = new EmbedBuilder()
            .setColor(0x0099ff) // 임베드 바 색깔
            .setTitle(`osu! 실시간 감지 유저 정보`)
            .setDescription(`osu! 실시간 감지 유저 정보`)
            .addFields(
                {   
                    name: `${username}님의 정보` , value: `최고기록 ${rankNum+1}등 이내의 기록(${rankPP}) 감지중`
                },
            );
        
        await interaction.reply({ embeds: [resultEmbed] });
    }
    else {
        const errorEmbed = new EmbedBuilder()
            .setColor(0x0099ff) // 임베드 바 색깔
            .setTitle('오류 발생')
            .setDescription(`유저를 찾을 수 없음`);
        
        await interaction.reply({ embeds: [errorEmbed] });

    }
}

async function updateUserBestPP(userId, num, mode) {
    if (mode == 0) console.log("등수를 기준으로 계산");
    if (mode == 1) console.log("pp를 기준으로 계산");
    let top_N_PP = await getUserBestPP(userId, num, mode);
    console.log (`top ${osu_userRankNum[username]} PP : ` + top_N_PP);
        
    data = JSON.parse(fs.readFileSync('./data.json'));
    data.osu_userRankPP[userId] = TOP50_PP_MAP.get(userId)[osu_userRankNum[username]-1];
    fs.writeFile('./data.json', JSON.stringify(data, null, 4),  'utf8', (err) => {
        if (err) {
            console.error("파일을 저장하는 중 오류 발생:", err);
            return;
        }
        console.log("osu_userRankPP가 성공적으로 업데이트되었습니다!");
    })
}

async function getUserBestPP(userId, num, mode){
    try {
        username = Object.entries(osu_userId).find(([key, value]) => value === userId)?.[0];
        let rankNum = 0, rankPP = 0;
        if (mode == 0) {
            //console.log("등수를 기준으로 계산");
            rankNum = num;
            rankPP = -1;
        }
        if (mode == 1) {
            //console.log("pp를 기준으로 계산");
            rankPP = num;
            rankNum = -1;
        }

        const response = await fetch(URL_get_user_best.replace("userId",userId).replace("OSU_USERRANKNUM",osu_userRankNum[username]), requestHeader_GET);
        CURRENT_API_COUNTER++;
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        //console.log("data :\n"+JSON.stringify(data, null, 4));

        // Update TOP50_PP_MAP
        let pp_datas = [];
        for (let i=0; i<50; i++){
            //console.log(`${i}번째 데이터의 pp : `+data[i].pp);
            pp_datas[i] = data[i].pp;
            if (data[i].pp < rankPP && rankNum == -1) rankNum = i-1;    // i-1 등을 포함한 높은 등수를 기록한 최고 기록을 조회함
            if (i < rankNum && rankPP == -1) rankPP = data[i].pp;       // i 등을 포함한 높은 등수를 기록한 최고 기록을 조회함
        }
        TOP50_PP_MAP.set(userId, pp_datas);

        //console.log(userId+"'s top 30 pp:"+TOP50_PP_MAP.get(userId)[osu_userRankNum[username]-1]);
        return data[osu_userRankNum[username]-1].pp;
        
    } catch(error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

// 비트맵 id, 유저 명, 모드 유무, 300/100/50/miss 갯수, 콤보 갯수, rank, pp 를 전부 가져옴
async function getAchievements(beatmapId, scoreId, userId){
    try {
        const response = await fetch((URL_get_scores.replace("userId",userId).replace("beatmapId",beatmapId)), requestHeader_GET);
        CURRENT_API_COUNTER++;
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const pureData = await response.json();

        const data =  pureData.map(({ 
            score_id, username, count300, count100, count50, countmiss, 
            maxcombo, enabled_mods, user_id, rank, pp 
        }) => ({
            score_id, username, count300, count100, count50, countmiss, 
            maxcombo, enabled_mods, user_id, rank, pp
        }));
        // 비트맵 id, 유저 명, 모드 유무, 300/100/50/miss 갯수, 콤보 갯수, rank, pp
        
        // beatmap Id는 일치하나, score Id가 일치하지 않는 경우는, 맵에 한정하여 기록 갱신이 되지 않은 경우이므로 제외한다.
        // ex) 최근 기록에서 180pp를 먹었으나, 이전 최고 기록이 250pp라서 180pp를 먹은 기록은 갱신 되지 않음

        if (data[0].score_id !== scoreId){
            console.log("해당 맵의 최고 기록과, recent 기록이 일치하지 않음 \/\/ 해당 맵의 최고 기록 pp : "+ data[0].pp);
            data[0].pp = -1;
            return data;

            // 모든 정보를 return 하되, pp를 -1으로 설정함
        }
        // 해당 맵의 최고기록임을 확인함
        console.log("해당 맵의 최고 기록과, recent 기록이 일치함 \/\/ 해당 맵의 최고 기록 pp : "+data[0].pp);
        return data;

        
    }
    catch (error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}




// 최근 기록 5개를 수집하여, pp를 수집하고 최고 30등의 pp보다 높으면 알림을 주는 기능
// 최근 기록 5개를 저장하기 위한 SAVED_ACHIEVEMENTS
// getUserRecent에서 기록을 가져옴 -> SAVED_ACHIEVEMENTS와 중복이 발생한다!
// => 즉시 getUserRecent 종료, API 요청 횟수를 최소화함
// 



async function compareUserRecent(userId){
    try {

        let recentScores = await getUserRecent(userId);

        // 중복되는 기록은 삭제
        /*
        const setA = new Set(recentScores.map(a => `${a.beatmap_id}-${a.score_id}`));
        const newData = B.filter(b => !setA.has(`${b.beatmap_id}-${b.score_id}`));
        */

        // 최근 기록이 갱신되지 않았으면, 종료시킴
        if (recentScores.length < 1){
            console.log('최근 기록이 갱신되지 않음.');
        }
        else {

            // 최근 5개의 기록중 밑에서부터 하나씩 기록 조사
            // 비트맵 id, 유저 명, 모드 유무, 300/100/50/miss 갯수, 콤보 갯수, rank, pp 를 전부 가져옴
            for (let i=0; i<recentScores.length; i++){
                const getData = await getAchievements(recentScores[i].beatmap_id, recentScores[i].score_id, recentScores[i].user_id)
                
                // 기록 조사를 처음부터 한다면, SAVED_ACHIEVEMENTS에 userId에 해당되는 새로운 배열을 생성
                if (!SAVED_ACHIEVEMENTS.has(userId)) {
                    SAVED_ACHIEVEMENTS.set(userId, []);  // userId에 대한 배열을 초기화
                
                }
                // 중복 검사, 만약 중복되는 경우가 있다면 getAchievements 작업을 종료함
                if (SAVED_ACHIEVEMENTS.get(userId).includes(getData[0].score_id)) {
                    console.log("중복 자료 발견함 종료.");     
                    break;
                }
                SAVED_ACHIEVEMENTS.get(userId).push(getData[0].score_id);

                // Set 형식을 읽을 수 있게 stringify 함
                // let array_achievements = JSON.stringify([...SAVED_ACHIEVEMENTS], null, 4);
            
                
                console.log("-------achievements Set----");
                //console.log(achievements+"\n");
                //console.log(array_achievements);
                console.log(getData);
                console.log("-------achievements----");
                
                
                //TOP50_PP_MAP에서 가져온 osu_userRankNum[username]등 pp
                let top_N_PP = TOP50_PP_MAP.get(userId)[osu_userRankNum[username]-1];
                //console.log(`top ${osu_userRankNum[username]} PP : ${top_N_PP} / achievements[${i}] : ${getData[0].pp}`);
    
    
                // 최고기록 osu_userRankNum[username]등의 pp량을 넘는 pp를 먹은 경우


                // 최고 기록이 2개 이상인 경우, 최고 기록 등수가 +1이 됨.

                if (+getData[0].pp > +top_N_PP){
                    // TOP50_PP_MAP 에 getData[0].pp 추가 후, 정렬
                    let editedNpplist = TOP50_PP_MAP.get(userId)
                    editedNpplist.push(getData[0].pp);
                    editedNpplist.sort((a, b) => b - a);

                    // 이후 가장 적은 데이터 1개 삭제
                    editedNpplist.pop();
                    let updatedRank = editedNpplist.indexOf(getData[0].pp);

                    // 수정한 TOP50_PP_MAP 데이터 적용
                    TOP50_PP_MAP.set(userId, editedNpplist);

                    const resultEmbed = new EmbedBuilder()
                        .setColor(0x0099ff) // 임베드 바 색깔
                        .setTitle(`osu! 실시간 감지 유저 정보`)
                        .setDescription(`osu! 실시간 감지 유저 정보`)
                        .addFields(
                            {   
                                name: `osu! 기록 갱신 알림` , value: `${username}님이 ${updatedRank+1} 번째 최고기록이 갱신되었습니다!\n획득 pp : ${getData[0].pp} / ${osu_userRankNum[username]}위 pp : ${top_N_PP}`,
                                name: `상세 점수`, value : `Rank : ${getData[0].rank} / FULL COMBO : ${getData[0].maxcombo} / Mods : ${getData[0].enabled_mods}, `,
                                name: `상세 점수`, value: `300 : ${getData[0].count300} / 100 : ${getData[0].count100} / 50 : ${getData[0].count50} / miss : ${getData[0].countmiss}`,
                            },
                        );
                    
                    await interaction.reply({ embeds: [resultEmbed] });

                    console.log(`${updatedRank+1} 번째 pp가 갱신되었습니다!`);
                    

                    console.log(`${getData[0].username}님이 최고 성과 ${updatedRank+1}등의 pp 기록을 갱신함!`);
                    console.log("300 : " + getData[0].count300 + " / 100 : "+getData[0].count100+" / 50 : "+getData[0].count50+" / miss : "+getData[0].countmiss);
                    // Mods checkMod() 구현 미완료
                    //console.log("Mods : "+ checkMod(getData[0].enabled_mods));
                    console.log("획득 pp : "+getData[0].pp + ` / ${osu_userRankNum[username]}위 pp : ` +top_N_PP);
                    
                }

                // 반복되는 recent 데이터가 없는 경우, 데이터 검사 시행
            }
        }
    }
    catch (error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

// 모드 체크
/*
    None           = 0,
    NoFail         = 1,
    Easy           = 2,
    TouchDevice    = 4,
    Hidden         = 8,
    HardRock       = 16,
    SuddenDeath    = 32,
    DoubleTime     = 64,
    Relax          = 128,
    HalfTime       = 256,
    Nightcore      = 512, // Only set along with DoubleTime. i.e: NC only gives 576
    Flashlight     = 1024,
    Autoplay       = 2048,
    SpunOut        = 4096,
 

function checkMod (mods_num){
    const Modes = ["None", "NoFail", "Easy", "TouchDevice", "Hidden", "HardRock", "SuddenDeath", "DoubleTime", "Relax", "HalfTime", "Nightcore", "Flashlight"];
    const convertMods = (x) => x > 0 ? Math.log2(x) + 1 : 0;
    return Modes[convertMods(mods_num)];
}
*/

async function getUserRecent(userId){
    try {
        let response = await fetch(URL_get_user_recent.replace("userId",userId), requestHeader_GET);
        CURRENT_API_COUNTER++;
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        let data = await response.json();
        // Recent Score중 score_id가 존재하는(클리어 책정이 된) 최근 5개의 기록만을 가져옴
        // [ {beatmap_id, user_id, score_id} ]
        
        let getScores = data
            .filter(({ score_id }) => {
                return score_id !== null;
            })
            .slice(0, 5)
            .map(({ beatmap_id, user_id, score_id }) => ({ beatmap_id, user_id, score_id }));
        
        return getScores;

    } catch (error){
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

function showBeatmapInfo(beatmapSetNum){
    fetch(URL_get_beatmap.replace("beatmapsetId",beatmapSetNum), requestHeader_GET)
    .then(response => {
        CURRENT_API_COUNTER++;
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then (data => {
        console.log(data);
    })
    .catch (error => {
        console.error('Error:', error);
    })
}


// 클라이언트의 토큰을 이용하여 디스코드에 로그인
client.login(token);