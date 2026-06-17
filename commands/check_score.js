const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('check_score')
        .setDescription('유저명과 score_id를 입력하여 Top50 이내 기록인지 확인하고 결과를 출력합니다.')
        .addStringOption(option =>
            option.setName('user')
                .setDescription('osu! 유저명을 입력하세요')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('score_id')
                .setDescription('확인할 score_id를 입력하세요')
                .setRequired(true)),
    async execute(interaction) {
    },
};
