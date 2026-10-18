import type { Archetype } from "./text";
import type { ItemKind, StationKind } from "./world";

export interface QuestDefinition {
  wanted: ItemKind;
  reward: ItemKind;
  destination: StationKind;
  title: string;
  instruction: string;
  thanks: string;
  otherGift: string;
  grumpy?: boolean;
}
export const QUESTS: Record<Archetype, QuestDefinition> = {
  hatless_farmer: { wanted: "hat", reward: "seed", destination: "planter", title: "The gate flowers", instruction: "My hat blew off. Bring it here, would you?", thanks: "That's mine. Take these seeds to the empty planter.", otherGift: "I'll put that by the gate. My hat's still gone.", grumpy: true },
  chicken_keeper: { wanted: "grain", reward: "meal", destination: "table", title: "Breakfast outside", instruction: "Bring me grain. The hens emptied the sack I had.", thanks: "The hens can eat. Put this bread on the picnic table.", otherGift: "I'll keep it above the hens. They eat paper too." },
  river_child: { wanted: "stone", reward: "leaf_boat", destination: "boat_launch", title: "The little boat", instruction: "Find me a flat stone. I'll hold my leaf down with it.", thanks: "It fits. Take my boat to the water's edge.", otherGift: "Can I keep it? I'll show my sister." },
  fisherman: { wanted: "bait", reward: "fish", destination: "table", title: "Fish for lunch", instruction: "Bring bait from the worm patch. My tin's empty.", thanks: "Got one. Put this fish on the picnic table for lunch.", otherGift: "Well, it fits in my bucket. Thank you." },
  couple: { wanted: "flower", reward: "note", destination: "song_post", title: "Their old song", instruction: "Could you fetch a flower? It's our anniversary.", thanks: "He remembered. Put our song sheet on the music stand.", otherGift: "He thinks it's a wedding present. I'll let him." },
  dog: { wanted: "apple", reward: "ribbon", destination: "lantern", title: "The dog's collar", instruction: "The dog sniffs your pocket, then looks at an apple.", thanks: "She drops a ribbon. It matches the lantern by the path.", otherGift: "She carries your gift a few steps and lies beside it." },
  letter_recipient: { wanted: "letter", reward: "oil", destination: "lantern", title: "A light for home", instruction: "Any post? My brother uses a yellow envelope.", thanks: "He's due home tonight. Take this oil to the lantern.", otherGift: "I'll show my brother. He keeps every present." },
  sleeper: { wanted: "flower", reward: "seed", destination: "planter", title: "After the nap", instruction: "I'm awake. Could you bring a flower for my windowsill?", thanks: "Smells good. Put these seeds in the empty planter.", otherGift: "Thanks. There's room beside my boots." },
  gardener: { wanted: "water", reward: "seed", destination: "planter", title: "A new pot", instruction: "Fill a can at the well and bring it here, please.", thanks: "The soil's wet now. Plant these seeds in the empty planter.", otherGift: "I'll keep it on the shelf by the can." },
  pie_seller: { wanted: "apple", reward: "meal", destination: "table", title: "One more pie", instruction: "I need an apple for one more pie. Check the grass.", thanks: "This'll do. Put the pie on the picnic table.", otherGift: "That's going under the counter. Mind the flour.", grumpy: true },
  neighbor: { wanted: "ribbon", reward: "oil", destination: "lantern", title: "The dog comes home", instruction: "My dog's lost her ribbon. Could you find it?", thanks: "I'll tie it on her collar. Fill the lantern with this oil.", otherGift: "She'll probably sniff it. Thanks for the visit." },
  cloud_watcher: { wanted: "leaf", reward: "note", destination: "song_post", title: "A tune outside", instruction: "Bring me a leaf. I used to whistle through them.", thanks: "Still works. Put this tune on the music stand.", otherGift: "I'll keep it beside me. There's room on the grass." },
  florist: { wanted: "water", reward: "flower", destination: "planter", title: "Flowers by the path", instruction: "Could you fill a can at the well? These stems are dry.", thanks: "They'll last now. Put this flower in the empty planter.", otherGift: "That can go beside the vase. Thank you." },
  shepherd: { wanted: "apple", reward: "ribbon", destination: "lantern", title: "The evening gate", instruction: "Find an apple for my sheep. She followed me here.", thanks: "She's eaten. Tie this ribbon on the lantern post.", otherGift: "The sheep wants it. I'll keep it in my coat.", grumpy: true },
  lighthouse_keeper: { wanted: "oil", reward: "note", destination: "song_post", title: "A tune at the pier", instruction: "The lighthouse needs oil. There's a flask on the sand.", thanks: "The lamp works. Put my tune on the music stand.", otherGift: "I'll leave it on the stair. There's a dry step." },
  sea_fisher: { wanted: "fish", reward: "meal", destination: "table", title: "Lunch on the beach", instruction: "Try the pier. Use worms, then pull when the float dips.", thanks: "Good catch. I've cooked it. Take lunch to the picnic table.", otherGift: "I've caught worse. A boot once, with both laces." },
  sand_kid: { wanted: "frog", reward: "leaf_boat", destination: "boat_launch", title: "A captain for the boat", instruction: "Find a frog by the garden. My boat needs a captain.", thanks: "He fits. Take the leaf boat to the water.", otherGift: "I'll put it in the castle. That room's empty." },
};

export interface Reply { text: string; next: number | null }
export interface ConversationNode { line: string; replies: Reply[] }
// The first node carries the errand. Either reply leads to a different ordinary conversation.
const TOPICS: Record<Archetype, [string, string, string, string]> = {
  hatless_farmer: ["Does it rain here?", "By noon, I think. I left my coat at home again.", "What would you do with today?", "Fix the gate, then eat with my daughter. The gate can wait until after lunch."],
  chicken_keeper: ["What's for breakfast?", "Eggs. My sister says I cook them too long. She eats two anyway.", "Do you miss the old place?", "The kitchen, yes. I wish I'd kept the height marks on the door."],
  river_child: ["How far can you skip one?", "Six skips. My sister says she got seven. Nobody saw it.", "What else will you do today?", "Find my sister. I was cross with her yesterday. I want to show her the boat."],
  fisherman: ["Any luck today?", "One fish before breakfast. I ate breakfast late.", "Do you come every day?", "I used to work Sundays too. My son learned to fish with someone else."],
  couple: ["Is this your usual bench?", "Yes. He says it was blue. I still have the green paint tin.", "How long have you been here?", "Forty years together. We still argue about where the cups go."],
  dog: ["Where's your person?", "She looks toward the cart and wags her tail.", "Can I sit here?", "She shifts her paws and leaves a patch of shade beside her."],
  letter_recipient: ["Does he write often?", "Tuesdays. His handwriting gets worse with every letter.", "What will you tell him?", "I'll ask him to visit. I keep forgetting to write that part."],
  sleeper: ["Did you sleep well?", "There's hay in my collar. The cow took my place in the shade.", "Long morning?", "I fixed the gate before breakfast. Tomorrow I'll eat first."],
  gardener: ["What do you grow?", "Beans. My mother put too much salt in hers. I still make them that way.", "Anything you'd plant again?", "Peas. My father liked them. I gave away his seed tin too soon."],
  pie_seller: ["What's in the crust?", "Cold butter. My aunt used lard. She'd complain about mine, then take another slice.", "Will you close early?", "My brother asked me to lunch last month. Today I'm going."],
  neighbor: ["Where does she go?", "Under my cart. I spent an hour calling her there yesterday.", "What will you do afterward?", "Walk her past my mother's house. She likes to see the dog."],
  cloud_watcher: ["Rain soon?", "The cows lay down. They also lie down when they're tired.", "Do you stay here all day?", "Sometimes. I should ask my brother to sit with me. He lives two doors away."],
  florist: ["Which flowers last?", "The yellow ones. Change the water tomorrow. My customers forget.", "Who gets the first bunch?", "My sister, today. I forgot her birthday. She said she noticed."],
  shepherd: ["Where's your sheep?", "Behind the barn again. She knows the gap under the fence.", "What if you had a day off?", "I'd take my wife to the sea. She's asked every summer."],
  lighthouse_keeper: ["How many stairs?", "Eighty. I count them when my knee hurts.", "Do you ever get a day off?", "My niece offered to cover. I'll ask her again. I'd like to see her school."],
  sea_fisher: ["What bait works?", "Worms. Bread falls off the hook. I ate the rest of mine.", "Who taught you?", "My dad. I wish I'd asked him how he made that fish stew."],
  sand_kid: ["Who lives in the castle?", "The frog gets the upstairs room. The downstairs is full of water.", "Will it stay up?", "The tide takes it every night. My brother helps me build the next one."],
};
export const CONVERSATIONS = Object.fromEntries(Object.entries(TOPICS).map(([name, topic]) => {
  const quest = QUESTS[name as Archetype];
  return [name, [
    { line: quest.instruction, replies: [{ text: topic[0], next: 1 }, { text: topic[2], next: 2 }] },
    { line: topic[1], replies: [{ text: topic[2], next: 2 }, { text: "I'll see you later.", next: null }] },
    { line: topic[3], replies: [{ text: "About that errand.", next: 0 }, { text: "See you soon.", next: null }] },
  ]];
})) as Record<Archetype, ConversationNode[]>;
