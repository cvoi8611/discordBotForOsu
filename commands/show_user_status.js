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
	},
    // async autocomplete(interaction) {
    //     const focusedOption = interaction.options.getFocused(true); // 현재 입력된 값
    //     const osuUsers = Object.keys(osu_userId);
    //     log(osuUsers);
    //     let choices;
    //     //["cvoi8611","Bard User","ignite4740","hyunwoo3353","RE_WIND","wopoy","_Kuzuma_"];

	// 	if (focusedOption.name === 'user') {
	// 		choices = ["cvoi8611","Bard User","ignite4740","hyunwoo3353","RE_WIND","wopoy","_Kuzuma_"];
	// 	}
    // }
};