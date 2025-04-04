const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const db = new sqlite3.Database('./database.sqlite');

// Criando a tabela se não existir
db.run(`CREATE TABLE IF NOT EXISTS estoque (item TEXT PRIMARY KEY, quantidade INTEGER)`);

// Registrando os comandos no Discord
const commands = [
    { name: 'add', description: 'Adiciona um item ao estoque', options: [
        { name: 'item', description: 'Nome do item', type: 3, required: true },
        { name: 'quantidade', description: 'Quantidade do item', type: 4, required: true }
    ] },
    { name: 'remove', description: 'Remove um item do estoque', options: [] },
    { name: 'list', description: 'Lista todos os itens do estoque' },
    { name: 'check', description: 'Verifica a quantidade de um item', options: [
        { name: 'item', description: 'Nome do item', type: 3, required: true }
    ] }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        console.log("🔄 Registrando comandos de barra...");
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log("✅ Comandos registrados com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao registrar comandos:", error);
    }
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'add') {
        const item = options.getString('item');
        const quantidade = options.getInteger('quantidade');
        db.run(`INSERT INTO estoque (item, quantidade) VALUES (?, ?) ON CONFLICT(item) DO UPDATE SET quantidade = quantidade + ?`,
            [item, quantidade, quantidade],
            err => {
                if (err) {
                    interaction.reply('❌ Erro ao adicionar item.');
                } else {
                    interaction.reply(`✅ Adicionado ${quantidade}x ${item} ao estoque.`);
                }
            }
        );
    }
    
    else if (commandName === 'remove') {
        db.all(`SELECT item, quantidade FROM estoque`, [], async (err, rows) => {
            if (err || rows.length === 0) {
                return interaction.reply("❌ O estoque está vazio ou houve um erro ao buscar os itens.");
            }
            
            const rowOptions = rows.map(row => ({
                label: `${row.item} (Qtd: ${row.quantidade})`,
                value: row.item
            }));
            
            const selectMenu = {
                type: 3,
                custom_id: "remove_item",
                options: rowOptions,
                placeholder: "Selecione o item a remover",
                min_values: 1,
                max_values: 1
            };

            await interaction.reply({
                content: "Selecione um item para remover:",
                components: [{ type: 1, components: [selectMenu] }]
            });
        });
    }
    
    else if (commandName === 'list') {
        db.all(`SELECT item, quantidade FROM estoque`, [], (err, rows) => {
            if (err || rows.length === 0) {
                return interaction.reply("❌ O estoque está vazio.");
            }

            const embed = new EmbedBuilder()
                .setTitle("📦 Estoque Atual")
                .setColor("Blue")
                .setDescription(rows.map(row => `**${row.item}**: ${row.quantidade}`).join('\n'));

            interaction.reply({ embeds: [embed] });
        });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isSelectMenu()) return;
    
    if (interaction.customId === "remove_item") {
        const selectedItem = interaction.values[0];
        
        await interaction.reply(`Quantos **${selectedItem}** deseja remover? Responda com um número.`);
        
        const filter = msg => msg.author.id === interaction.user.id && !isNaN(msg.content);
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => {});
        
        if (!collected) {
            return interaction.followUp("⏳ Tempo esgotado! Tente novamente.");
        }
        
        const quantidade = parseInt(collected.first().content);
        db.run(`UPDATE estoque SET quantidade = quantidade - ? WHERE item = ? AND quantidade >= ?`,
            [quantidade, selectedItem, quantidade],
            function(err) {
                if (err || this.changes === 0) {
                    interaction.followUp(`❌ Não foi possível remover ${quantidade}x ${selectedItem}. Verifique o estoque.`);
                } else {
                    interaction.followUp(`✅ Removido ${quantidade}x ${selectedItem} do estoque.`);
                }
            }
        );
    }
});

client.login(process.env.TOKEN);
