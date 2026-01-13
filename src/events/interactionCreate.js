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
        await interaction.reply({
             files: [{ attachment: '../images/blue_screen_aris.jpg' }],
            content: "요청을 너무 많아 받아 봇이 디졌습니다."
            });
        return;
    }

    // 현재 시간 기준 1분 내 요청만 필터링
    userData.timestamps = userData.timestamps.filter(ts => now - ts < timeWindow);
    
    if (userData.timestamps.length >= maxRequests) {
        userData.blockedUntil = now + blockDuration; // 차단 설정
        await interaction.reply({ 
            files: [{ attachment: '../images/blue_screen_aris2.jpg' }] ,
            content: "너무 많은 요청을 보냈습니다! 30초 후 다시 시도하세요."
        });
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