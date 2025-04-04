const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const db = new sqlite3.Database('./database.sqlite');

// Criando a tabela se não existir
db.run(`CREATE TABLE IF NOT EXISTS estoque (item TEXT, quantidade INTEGER)`);

// Registrando os comandos no Discord
const commands = [
    { name: 'add', description: 'Adiciona um item ao estoque', options: [
        { name: 'item', description: 'Nome do item', type: 3, required: true },
        { name: 'quantidade', description: 'Quantidade do item', type: 4, required: true }
    ] },
    { name: 'remove', description: 'Remove um item do estoque', options: [
        { name: 'item', description: 'Nome do item', type: 3, required: true }
    ] },
    { name: 'list', description: 'Lista todos os itens do estoque' },
    { name: 'check', description: 'Verifica a quantidade de um item', options: [
        { name: 'item', description: 'Nome do item', type: 3, required: true }
    ] }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        console.log('🔄 Registrando comandos de barra...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Comandos registrados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
})();

client.once('ready', () => {
    console.log(`✅ Bot está online como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const { commandName, options } = interaction;

    const sendEmbed = (title, description) => {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor('#000000')  // Cor preta
            .setTimestamp();
        interaction.reply({ embeds: [embed] });
    };    

    if (commandName === 'add') {
        const item = options.getString('item');
        const quantidade = options.getInteger('quantidade');
        db.run(`INSERT INTO estoque (item, quantidade) VALUES (?, ?)`, [item, quantidade], err => {
            if (err) return sendEmbed('Erro', '❌ Erro ao adicionar o item.', 'Red');
            sendEmbed('Item Adicionado', `✅ **${item}** adicionado com quantidade **${quantidade}**.`);
        });
    }

    if (commandName === 'remove') {
        const item = options.getString('item');
        db.run(`DELETE FROM estoque WHERE item = ?`, [item], err => {
            if (err) return sendEmbed('Erro', '❌ Erro ao remover o item.', 'Red');
            sendEmbed('Item Removido', `✅ **${item}** removido com sucesso.`);
        });
    }

    if (commandName === 'list') {
        db.all(`SELECT * FROM estoque`, [], (err, rows) => {
            if (err) return sendEmbed('Erro', '❌ Erro ao listar o estoque.', 'Red');
            if (rows.length === 0) return sendEmbed('Estoque Vazio', '📦 Nenhum item no estoque.', 'Yellow');
            const itemList = rows.map(row => `**${row.item}**: ${row.quantidade}`).join('\n');
            sendEmbed('📦 Estoque Atual', itemList, 'Green');
        });
    }

    if (commandName === 'check') {
        const item = options.getString('item');
        db.get(`SELECT quantidade FROM estoque WHERE item = ?`, [item], (err, row) => {
            if (err) return sendEmbed('Erro', '❌ Erro ao verificar o item.', 'Red');
            if (!row) return sendEmbed('Item Não Encontrado', `📦 O item **${item}** não existe no estoque.`, 'Yellow');
            sendEmbed('📦 Verificação de Item', `**${item}** tem **${row.quantidade}** unidades.`, 'Blue');
        });
    }
});

client.login(process.env.DISCORD_TOKEN);