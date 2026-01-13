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
            await interaction.reply({ files: [{ attachment: '../images/blue_screen_aris.jpg' }] });
            await interaction.reply("요청을 너무 많아 받아 봇이 디졌습니다.");
            return;
        }


        // 현재 시간 기준 1분 내 요청만 필터링
        userData.timestamps = userData.timestamps.filter(ts => now - ts < timeWindow);
        console.log(`userData.timestamps.length : ${userData.timestamps.length}`);
        console.log(`maxRequests : ${maxRequests}`);
        
        if ((userData.timestamps.length >= maxRequests)) {
            userData.blockedUntil = now + blockDuration; // 차단 설정
            message.channel.send({ files: [{ attachment: '../images/blue_screen_aris2.jpg' }] });
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
});