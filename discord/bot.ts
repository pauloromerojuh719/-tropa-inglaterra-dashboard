import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  console.log("❌ DISCORD_BOT_TOKEN não foi encontrado.");
  process.exit(1);
}

if (!guildId) {
  console.log("❌ DISCORD_GUILD_ID não foi encontrado.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  console.log(`🤖 Bot conectado como ${client.user?.tag}`);

  const guild = await client.guilds.fetch(guildId);
  const members = await guild.members.fetch();

  console.log(`👥 Total de membros no Discord: ${members.size}`);

  members.forEach((member) => {
    if (!member.user.bot) {
      console.log(`- ${member.displayName} | ID: ${member.id}`);
    }
  });
});

client.login(token);