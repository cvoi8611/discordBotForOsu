const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName("실시간모드")
		.setDescription('실시간 모드를 활성화합니다.')
		.addNumberOption(option => 
			option.setName('mode')
				.setDescription('활성화하려면 1, 비활성화 하려면 0')
				.setRequired(true)),
	async execute(interaction) {
		const mode = interaction.options.getNumber('mode');
        if (mode !== 0 | 1) {
                const errorEmbed = new EmbedBuilder()
                .setColor(0x0099ff) // 임베드 바 색깔
                .setTitle('오류 발생')
                .setDescription(`1 또는 0 을 입력해주세요`);
            await interaction.reply({ embeds: [errorEmbed] });
        }
        else {
            let currentmode = (mode == 1 ? "활성화" : "비활성화");
            const resultEmbed = new EmbedBuilder()
                .setColor(0x0099ff) // 임베드 바 색깔
                .setTitle('모드 변경됨')
                .setDescription(`실시간 감지 기능이 ${currentmode}되었습니다.`);

            await interaction.reply({ embeds: [resultEmbed] });

        }
		
	},
};