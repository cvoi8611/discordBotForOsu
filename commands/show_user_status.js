const { osu_userId, osu_userPP_rank, osu_userTopPP } = require('../data.json')
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName("유저_정보")
		.setDescription('실시간 감지에 사용되는 등수, pp를 보여줍니다.')
        .addStringOption(option => 
            option.setName('user')
                .setDescription('osu! 유저명을 입력하세요')
                .setAutocomplete(true)  // 자동완성 활성화
        ),
	async execute(interaction) {
        //
        // ...? 왜 안됨??
        //
		// const username = interaction.options.getString('user');
        // const userId = osu_userId[username];
        // const rankNum = osu_userPP_rank[username];
        // const rankPP = osu_userTopPP[userId];
        // console.log(username, userId, rankNum, rankPP);
        // if (osuUsers.includes(username)) {
        //     const resultEmbed = new EmbedBuilder()
        //         .setColor(0x0099ff) // 임베드 바 색깔
        //         .setTitle(`osu! 실시간 감지 유저 정보`)
        //         .setDescription(`osu! 실시간 감지 유저 정보`)
        //         .addFields(
        //             {   
        //                 name: `${username}님의 정보` , value: `최고기록 ${rankNum}등 이내의 기록(${rankPP}) 감지중`
        //             },
        //         );

        //     await interaction.reply({ embeds: [resultEmbed] });
        // }
        // else {
        //     const errorEmbed = new EmbedBuilder()
        //         .setColor(0x0099ff) // 임베드 바 색깔
        //         .setTitle('오류 발생')
        //         .setDescription(`유저를 찾을 수 없음`);
            
        //     await interaction.reply({ embeds: [errorEmbed] });

        // }
	},
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused(); // 현재 입력된 값
        const osuUsers = Object.keys(osu_userPP_rank);

        // 입력값과 부분적으로 일치하는 유저명 필터링
        const filtered = osuUsers.filter(user => user.toLowerCase().includes(focusedValue.toLowerCase()));

        // 최대 25개의 추천 목록을 응답으로 보냄
        await interaction.respond(
            filtered.map(user => ({ name: user, value: user })).slice(0, 7)
        );
    }
};