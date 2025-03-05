const { REST, Routes } = require('discord.js');
const { Client, Collection ,Events, GatewayIntentBits, Message, MessageCollector, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { clientId, guildId, token, osu_token} = require('./config.json');
const { osu_userId, osu_userTopPP } = require('./data.json');
const fs = require('fs');
const path = require('path');

// TOP_PP_NUMBER = 1 ~ 100
const TOP_PP_NUMBER = 50;

let MONITORING_AVAILABLE = false;


const URL_get_beatmap = `https://osu.ppy.sh/api/get_beatmaps?k=${osu_token}&s=beatmapsetId`;
const URL_get_user = `https://osu.ppy.sh/api/get_user?k=${osu_token}&u=userId`;
const URL_get_user_best = `https://osu.ppy.sh/api/get_user_best?k=${osu_token}&u=userId&limit=${TOP_PP_NUMBER}`;
const URL_get_user_recent = `https://osu.ppy.sh/api/get_user_recent?k=${osu_token}&u=userId`;
const URL_get_scores = `https://osu.ppy.sh/api/get_scores?k=${osu_token}&b=beatmapId&u=userId`;



let SAVED_ACHIEVEMENTS = new Map();
let TOP_PP_MAP = new Map();

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


client.on('ready', async () => { 
    // guildId = 슬래시 명령어를 등록할 서버 ID
    const guild = client.guilds.cache.get(guildId);

    await guild.commands.create({
        name: '실시간모드', // 명령어 이름
        description: 'osu! 실시간 pp 모니터링 모드 on/off 합니다. (기본값 : off)',
    });

    // await guild.commands.create({
    //     name: '등수 입력',
    //     description: '최고 성과 (입력한 숫자)등 이내의 기록을 실시간 모니터링 합니다. (기본값 : 50)',
    //     options : [
    //         {
    //             type: 4,  // 숫자 타입
    //             name: 'ranking_num',  // 옵션 이름
    //             description: 'Enter a number', // 옵션 설명
    //             required: true,   // 필수 입력
    //         }
    //     ]
    // })

    console.log('command registered!');
});


// 슬래쉬 ('/') 명령어 응답 코드
client.on('interactionCreate', async interaction =>{
    if (!interaction.isChatInputCommand()) return;
    
    // 메시지 읽는 코드
    // console.log(`[${message.guild.name}] ${message.author.tag}: ${message.content}`);

    const commandName = interaction.commandName;
    console.log(commandName);
    switch (commandName) {
        case '실시간모드':
            if (!MONITORING_AVAILABLE){
                MONITORING_AVAILABLE = !MONITORING_AVAILABLE;
                await interaction.reply('실시간 모드 켜짐');
                //observePPChange();
            }
            else {
                MONITORING_AVAILABLE = !MONITORING_AVAILABLE;
                await interaction.reply('실시간 모드 꺼짐');
            }
            break;
        case '등수 입력':
            TOP_PP_NUMBER = interaction.options.getNumber('ranking_num');
            await interaction.reply(`최고 성과 ${TOP_PP_NUMBER}등 이내의 기록을 실시간 모니터링 합니다.`);
            
            for (let user in osu_userId) {
                console.log(`osu! 실시간 감지 기능 ${user} 등록됨.`);
                updateUserBestPP(osu_userId[user]);
            }
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
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then (data => {
                // 데이터를 정상적으로 받아옴

                // 데이터를 받아오면, Example Embed 구성함
                let exampleEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Some title')
                    .setURL('https://osu.ppy.sh/')
                    .setDescription('Some description here')
                    .setThumbnail('https://assets.ppy.sh/beatmaps/beatmapset_id/covers/cover.jpg')
                    .setTimestamp()


                // 난이도 순으로 정렬
                data.sort((a, b) => a.difficultyrating - b.difficultyrating);
                
                // standard외 다른 모드 제거
                data = data.filter(item => item.mode =! 0)
                
                console.log(data);
                
                // 난이도 갯수 Count
                let diffRatings = data.map(beatmap => parseFloat(beatmap.difficultyrating));
                let numberOfDiff = diffRatings.length;


                // 맵 제목, 제작자 addFields
                exampleEmbed.addFields(
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
                    
                    exampleEmbed.addFields(
                        { name: data[i].version+"\nby "+data[i].creator, value: starRating.toFixed(2)+'★\n(SS) '+ rawPP + ' pp' , inline: true }
                    )
                }

                // 전체적인 beatmap 정보 메시지로 출력 (Embeds로 출력함)
                message.channel.send({ embeds: [
                    exampleEmbed
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



// 봇이 켜지면서 동시에 등록된 유저들의 최고기록 (TOP_PP_NUMBER)등의 pp를 받아와서 저장함
// 이후, 지속적으로 유저들의 recent 기록을 n sec마다 확인
// -> recent 기록에서 확인된 pp....가 있으면 편한데 pp를 확인 못함 ㅅㅂ..
    // 이게 존나 문제임 tq 어카지
// 최고기록 (TOP_PP_NUMBER)등의 pp 이상의 pp를 먹은 기록이 생겼다면, 이를 알리고 최고기록 (TOP_PP_NUMBER)등의 pp를 다시 받아와서 저장함

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


async function observePPChange(){
    let counter = 0;

    while (MONITORING_AVAILABLE){
        await wait(10000);  // 10sec
        console.log("Hello?");
    }
}


// 실시간 기능 안넣고 수동으로 돌아가게끔 하는 테스트 코드
client.on('messageCreate', message => {
    if (message.author.bot) return; // 봇 메시지는 무시
    if (message.content.match("activate auto check")){
        
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

async function registerUserData(userId){
    
}

async function updateUserBestPP(userId) {
    let top_N_PP = await getUserBestPP(userId);
    console.log (`top ${TOP_PP_NUMBER} PP : ` + top_N_PP);
        
    data = JSON.parse(fs.readFileSync('./data.json'));
    data.osu_userTopPP[userId] = TOP_PP_MAP.get(userId)[TOP_PP_NUMBER-1];
    fs.writeFile('./data.json', JSON.stringify(data, null, 4),  'utf8', (err) => {
        if (err) {
            console.error("파일을 저장하는 중 오류 발생:", err);
            return;
        }
        console.log("osu_userTopPP가 성공적으로 업데이트되었습니다!");
    })
}

async function getUserBestPP(userId){
    try {
        const response = await fetch(URL_get_user_best.replace("userId",userId), requestHeader_GET);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // Update TOP_PP_MAP
        let pp_datas = [];
        for (let i=0; i<TOP_PP_NUMBER; i++){
            pp_datas[i] = data[i].pp;
        }
        TOP_PP_MAP.set(userId, pp_datas);

        console.log(userId+"'s top 30 pp:"+TOP_PP_MAP.get(userId)[TOP_PP_NUMBER-1]);
        return data[TOP_PP_NUMBER-1].pp;
        
    } catch(error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

// 비트맵 id, 유저 명, 모드 유무, 300/100/50/miss 갯수, 콤보 갯수, rank, pp 를 전부 가져옴
async function getAchievements(beatmapId, scoreId, userId){
    try {
        const response = await fetch((URL_get_scores.replace("userId",userId).replace("beatmapId",beatmapId)), requestHeader_GET);
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
                
                
                //TOP_PP_MAP에서 가져온 TOP_PP_NUMBER등 pp
                let top_N_PP = TOP_PP_MAP.get(userId)[TOP_PP_NUMBER-1];
                //console.log(`top ${TOP_PP_NUMBER} PP : ${top_N_PP} / achievements[${i}] : ${getData[0].pp}`);
    
    
                // 최고기록 30등의 pp량을 넘는 pp를 먹은 경우

                if (+getData[0].pp > +top_N_PP){
                    // TOP_PP_MAP 에 getData[0].pp 추가 후, 정렬
                    let editedNpplist = TOP_PP_MAP.get(userId)
                    editedNpplist.push(getData[0].pp);
                    editedNpplist.sort((a, b) => b - a);

                    // 이후 가장 적은 데이터 1개 삭제
                    editedNpplist.pop();
                    let updatedRank = editedNpplist.indexOf(getData[0].pp);

                    // 수정한 TOP_PP_MAP 데이터 적용
                    TOP_PP_MAP.set(userId, editedNpplist);

                    console.log(`${updatedRank} 번째 pp가 갱신되었습니다!`);
                    

                    console.log(`${getData[0].username}님이 최고 성과 ${updatedRank}등의 pp 기록을 갱신함!`);
                    console.log("300 : " + getData[0].count300 + " / 100 : "+getData[0].count100+" / 50 : "+getData[0].count50+" / miss : "+getData[0].countmiss);
                    // Mods checkMod() 구현 미완료
                    //console.log("Mods : "+ checkMod(getData[0].enabled_mods));
                    console.log("획득 pp : "+getData[0].pp + ` / 최고 ${TOP_PP_NUMBER}위 pp : ` +top_N_PP);
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