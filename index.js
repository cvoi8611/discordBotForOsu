// 필수적인 discord.js 클래스들을 가져옴

//const express = require('express');
//const app = express();

const { EmbedBuilder } = require("discord.js");


/*
function calculateRawPP (beatmap_data) {
    // osu! Performance Calculator 오픈 소스 활용함
    // 아래 값은 대략적으로 측정된 값임

    let countNote = beatpmap_data.count_normal;
    let countSlider = beatpmap_data.count_slider;
    let countSpinner = beatpmap_data.count_spinner;
    let totalObjects = countNote + countSlider + countSpinner

    let circleSize = beatmap_data.diff_size;        // CS
    let overallDiff = beatmap_data.diff_overall;    // OD
    let approachRate = beatmap_data.diff_approach;  // AR
    let healthDrain = beatmap_data.diff_drain;      // HP

    let mapLength = beatmap_data.hit_length;
    let aimDiff = beatmap_data.diff_aim;
    let speedDiff = beatmap_data.diff_speed;

    // Length Bonus 계산
    const amountObjectsOver2k = totalObjects / 2000;
    let lengthBonus = 0.95 + (0.4 * Math.min(1, amountObjectsOver2k));
    if (totalObjects > 2000) {
        lengthBonus += Math.log10(amountObjectsOver2k) * 0.5;
    }

    // AR Bonus
    let arBonus = 0;
    if (approachRate > 10.33) {
        arBonus += 0.4 * (approachRate - 10.33);
    } else if (approachRate < 8.0) {
        arBonus += 0.1 * (8.0 - approachRate);
    }
    
    // Aim PP 계산
    let aimPP = getBasePP(stats.aim);
    aimPP *= lengthBonus;
    aimPP *= (1 + Math.min(arBonus, arBonus * (totalObjects / 1000)));

    // Speed PP 계산
    let speedPP = getBasePP(stats.speed);
    speedPP *= lengthBonus;

    // Accuracy PP 계산
    let accuracy = 100; // 100% 정확도
    let accPP = (1.52163 ** difficulty.od) * (accuracy / 100) ** 24 * 2.83;
    accPP *= Math.min(1.15, ((totalObjects / 1000) ** 0.3));

    // 최종 PP 계산
    const finalMultiplier = 1.12;
    let totalPP = Math.pow(
        Math.pow(aimPP, 1.1) + Math.pow(speedPP, 1.1) + Math.pow(accPP, 1.1),
        1 / 1.1
    ) * finalMultiplier;

    return totalPP;
}
*/

const { Client, Events, GatewayIntentBits, Message, messageLink, MessageCollector } = require('discord.js');
const { token } = require('./config.json');
const { osu_token } = require('./config.json');

const URL_get_beatmap = `https://osu.ppy.sh/api/get_beatmaps?k=${osu_token}&s=beatmapsetId`;
const URL_get_user = `/api/get_user?k=${osu_token}&u=userId`;
const URL_get_user_best = `/api/get_user_best?k=${osu_token}&u=userId`;
const URL_get_user_recent = `/api/get_user_recent?k=${osu_token}&u=userId`;


const requestHeader_GET = {
    mothod: "GET",
    header: {
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

    const { commandName } = interaction;

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
    console.log(`[${message.guild.name}] ${message.author.tag}: ${message.content}`);
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


//osu 유저들 실시간 감시 및, 기록 갱신시 알림 코드
fetch(URL_get_user.replace("userId",9098416), requestHeader_GET)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then (data => {
        
    })

// 클라이언트의 토큰을 이용하여 디스코드에 로그인
client.login(token);