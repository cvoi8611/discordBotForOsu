const { Client, Events, GatewayIntentBits, Message, messageLink, MessageCollector, EmbedBuilder } = require('discord.js');
const { token, osu_token} = require('./config.json');
const { osu_userId, osu_userTopPP } = require('./data.json');
const fs = require('fs');

const URL_get_beatmap = `https://osu.ppy.sh/api/get_beatmaps?k=${osu_token}&s=beatmapsetId`;
const URL_get_user = `https://osu.ppy.sh/api/get_user?k=${osu_token}&u=userId`;
const URL_get_user_best = `https://osu.ppy.sh/api/get_user_best?k=${osu_token}&u=userId&limit=30`;
const URL_get_user_recent = `https://osu.ppy.sh/api/get_user_recent?k=${osu_token}&u=userId`;
const URL_get_scores = `https://osu.ppy.sh/api/get_scores?k=${osu_token}&b=beatmapId&u=userId`;

let SAVED_RECENT_SCORES;

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

// 명령어 응답 코드
client.on('interactionCreate', async interaction =>{
    if (!interaction.isCommand()) return;
    
    // 메시지 읽는 코드
    console.log(`[${message.guild.name}] ${message.author.tag}: ${message.content}`);

    const commandName = interaction.commandName;
    console.log(commandName);
    switch (commandName) {
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
                    let rawPP = 0
                    
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



// 봇이 켜지면서 동시에 등록된 유저들의 최고기록 30등의 pp를 받아와서 저장함
// 이후, 지속적으로 유저들의 recent 기록을 n sec마다 확인
// -> recent 기록에서 확인된 pp....가 있으면 편한데 pp를 확인 못함 ㅅㅂ..
    // 이게 존나 문제임 ㅅㅂ 어카지
// 최고기록 30등의 pp 이상의 pp를 먹은 기록이 생겼다면, 이를 알리고 최고기록 30등의 pp를 다시 받아와서 저장함
    // 결국에 이것도 문제임 pp 시발.....

// 해결 방법
// -> get_score에서 scoreId를 입력해서 가져오면 해당 맵에서 얻은 pp가 나오는 것을 확인
// user_recent에서 얻은 score의 scoreId를 가져가서 get_score에 userId랑 scoreId를 같이 query해서 score의 pp를 구하는 방식
// 하나의 recent 요청에 get_recent, get_score 2번의 api 요청이 사용됨
// 총 인원은 7명이므로, 한바퀴 확인하는데 14번의 api 요청이 사용됨
// 분당 60번의 횟수 제한이 존재하므로... 30초마다 14번 총 요청 횟수는 분당 28번으로 하는 것을 목표로 한다.


//osu 유저들 실시간 감시 및, 기록 갱신시 알림 코드


// 실시간 기능 안넣고 수동으로 돌아가게끔 하는 테스트 코드
client.on('messageCreate', message => {
    if (message.author.bot) return; // 봇 메시지는 무시
    if (message.content.match("def user best pp")){
        let userId = "9098416";
        defineUserBestPP(userId);
    }
    if (message.content.match("check score test")){
        checkScorePP();
    }
    if (message.content.match("get_scores test")){
        let bi = "1126965";
        let ui = "9098416";
        let si = "4790229507";
        testScore(bi, ui, si);
    }

    if (message.content.match("recent")){
        userId = "9098416";
        compareUserRecent(userId);
    }
    if (message.content.match("show beatmap")){
        let beatmapSetNum = "384772";
        showBeatmapInfo(beatmapSetNum);
    }
    
})



/*
function defineUserBestPP(userId){
    fetch(URL_get_user_best.replace("userId",userId), requestHeader_GET)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then (data => {
        let topPP = data[0].pp;
        console.log(userId+"'s top 1 pp:"+topPP);
        let top30PP = data[29].pp;
        console.log(userId+"'s top 30 pp:"+top30PP);
        return top30PP;
    })
    .catch(error => {
        console.error('Error:', error);
    });
}
*/

async function testScore(beatmapId, userId, scoreId){
    try {
        const response = await fetch((URL_get_scores.replace("userId",userId).replace("beatmapId",beatmapId)), requestHeader_GET);
        console.log(URL_get_scores.replace("userId",userId).replace("beatmapId",beatmapId));

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log("받은 직후 data :"+ data);
        console.log("JSON.stringify 거친 data :"+ JSON.stringify(data, null, 4));
        
        return data;

        /*

        // 비트맵 id, 유저 명, 모드 유무, 300/100/50/miss 갯수, 콤보 갯수, rank, pp
        data
        .map(({ 
            score_id, username, count300, count100, count50, countmiss, 
            maxcombo, enabled_mods, user_id, rank, pp 
        }) => ({
            score_id, username, count300, count100, count50, countmiss, 
            maxcombo, enabled_mods, user_id, rank, pp
        }));
        console.log("map 거친 직후 data :"+data);

        // beatmap Id는 일치하나, score Id가 일치하지 않는 경우는, 기록 갱신이 되지 않은 경우이므로 제외한다.
        // ex) 최근 기록에서 180pp를 먹었으나, 이전 최고 기록이 189pp라서 180pp를 먹은 기록은 갱신 되지 않음
        if (data.score_id !== scoreId){
            console.log("beatmap Id는 일치하나, score Id가 일치하지 않는 경우\n"+data);
            data.pp = 0;
            return data;

            // 빈 배열 return 하면 안댐
            
            // score id가 일치하지 않으면 빈 배열을 return함
        }
        console.log("getAchievements Data renewed\n"+data);
        return data;
        */
    }
    catch (error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}

async function defineUserBestPP(userId) {
    let top30PP = await getUserBestPP(userId);
    console.log ("top30PP : " + top30PP);
        
    data = JSON.parse(fs.readFileSync('./data.json'));
    data.osu_userTopPP[userId] = top30PP;
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

        let topPP = data[0].pp;
        console.log(userId+"'s top 1 pp:"+topPP);
        let top30PP = data[29].pp;
        console.log(userId+"'s top 30 pp:"+top30PP);
        return top30PP;
        
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

        // beatmap Id는 일치하나, score Id가 일치하지 않는 경우는, 기록 갱신이 되지 않은 경우이므로 제외한다.
        // ex) 최근 기록에서 180pp를 먹었으나, 이전 최고 기록이 189pp라서 180pp를 먹은 기록은 갱신 되지 않음
        if (data.score_id !== scoreId){
            console.log("getAchievements Data not renewed\n"+data);
            data[0].pp = 0;
            return data;

            // 빈 배열 return 하면 안댐
            
            // score id가 일치하지 않으면 빈 배열을 return함
        }
        console.log("getAchievements Data renewed\n"+data);
        return data;
    }
    catch (error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}




// 최근 기록 5개를 수집하여, pp를 수집하고 최고 30등의 pp보다 높으면 알림을 주는 기능
// 최근 기록 5개를 저장하기 위한 SAVED_RECENT_SCORES
// getUserRecent에서 기록을 가져옴 -> SAVED_RECENT_SCORES와 중복이 발생한다!
// => 즉시 getUserRecent 종료, API 요청 횟수를 최소화함
// 



async function compareUserRecent(userId){
    try {

        let recentScores;
        let newRecentScores = await getUserRecent(userId);

        // 중복되는 기록은 삭제
        /*
        const setA = new Set(recentScores.map(a => `${a.beatmap_id}-${a.score_id}`));
        const newData = B.filter(b => !setA.has(`${b.beatmap_id}-${b.score_id}`));
        */

        // 새로운 유의미한 기록이 갱신되지 않았으면, 종료시킴
        if (newRecentScores.length < 1){
            console.log('새로운 유의미한 기록이 갱신되지 않음.');
        }
        else {
            console.log ('의미있는 기록을 발견함.');
            recentScores = newRecentScores;
            console.log (newRecentScores);
            for (let i=0; i<newRecentScores.length; i++){
                console.log (`의미있는 score_id : `+recentScores[i].score_id);
            }

            // 최근 5개의 기록중 밑에서부터 하나씩 기록 조사
            // 비트맵 id, 유저 명, 모드 유무, 300/100/50/miss 갯수, 콤보 갯수, rank, pp 를 전부 가져옴

            let achievements = new Set();

            for (let i=recentScores.length-1; i>=0; i--){
                const getData = await getAchievements(recentScores[i].beatmap_id, recentScores[i].score_id, recentScores[i].user_id)
                if (achievements.has(getData)) break;

                achievements.add(getData);
                let array_achievements = JSON.stringify([...achievements], null, 4);
            
                console.log("-------achievements Set----");
                console.log(achievements+"\n");
                console.log(array_achievements);
                console.log("-------achievements----");

                
                //config.json에서 가져온 30등 pp
                let top30PP = osu_userTopPP[userId];
                console.log(`top30PP : ${top30PP} / achievements[${i}] : ${array_achievements[0][0].pp}`);
    
    
                // 최고기록 30등의 pp량을 넘는 pp를 먹은 경우
                // if (JSON.stringify(achievements[recentScores.length-i+1].pp) > top30PP){
                //     console.log("이쌔끼 또 기록 세웠어요!!!!! 재능충새기!!!!!!!");
                //     console.log("세운 기록 : " + achievements[i].beatmap_id);
                //     console.log("획득 pp : "+achievements[i].pp);
                // }

                // 반복되는 recent 데이터가 없는 경우, 데이터 검사 시행

                
            }
            

        }
    }
    catch (error) {
        console.error('Error:', error);
        return null; // 에러 발생 시 null 반환
    }
}


async function getUserRecent(userId){
    try {
        let response = await fetch(URL_get_user_recent.replace("userId",userId), requestHeader_GET);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        let data = await response.json();
        // Recent Score중 유의미한 최근 5개의 기록만을 가져옴
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

function getUserBestScore(userId){
    fetch(URL_get_user_best.replace("userId",9098416), requestHeader_GET)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then (data => {

        console.log(data[30].pp);
        console.log(data[30]);
    })
    .catch (error => {
        console.error('Error:', error);
    })
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