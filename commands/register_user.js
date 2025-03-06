const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName("유저_등록")
		.setDescription('유저들의 최고기록 정보를 가져옵니다.'),
	async execute(interaction) {
		// const mode = interaction.options.getNumber('mode');
        // if (mode !== 0 | 1) {
        //         const errorEmbed = new EmbedBuilder()
        //         .setColor(0x0099ff) // 임베드 바 색깔
        //         .setTitle('오류 발생')
        //         .setDescription(`1 또는 0 을 입력해주세요`);
        //     await interaction.reply({ embeds: [errorEmbed] });
        // }
        // else {
        //     let currentmode = (mode == 1 ? "활성화" : "비활성화");
        //     const resultEmbed = new EmbedBuilder()
        //         .setColor(0x0099ff) // 임베드 바 색깔
        //         .setTitle('모드 변경됨')
        //         .setDescription(`실시간 감지 기능이 ${currentmode}되었습니다.`);

        //     await interaction.reply({ embeds: [resultEmbed] });

        // }
		
	},
};