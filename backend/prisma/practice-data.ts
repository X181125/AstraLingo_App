type Choice = [prompt: string, correct: string, wrong1: string, wrong2: string, explanation: string];

function reading(body: string, ...choices: Choice[]) {
  return { body, questions: choices.map(([prompt, correct, wrong1, wrong2, explanation], index) => {
    const options = [wrong1, wrong2];
    const answer = (index + 1) % 3;
    options.splice(answer, 0, correct);
    return { prompt, options, answer, explanation };
  }), transcript: [] };
}

function listening(lines: string[], ...choices: Choice[]) {
  const body = lines.join('\n');
  let second = 0;
  const transcript = lines.map(text => {
    const part = { second, text };
    second += Math.max(3, Math.ceil(text.split(/\s+/).length / 2.2));
    return part;
  });
  return { ...reading(body, ...choices), transcript };
}

export const practiceData: Record<string, ReturnType<typeof reading> | ReturnType<typeof listening>> = {
  'english-first-steps-1': reading(
    'Hello! My name is Linh. I live in Da Nang. I am a student. In the morning, I say “Good morning” to my classmates. After school, I play badminton with my brother.',
    ['Where does Linh live?', 'Da Nang', 'Ha Noi', 'London', 'Linh says “I live in Da Nang”.'],
    ['What does Linh do after school?', 'Plays badminton', 'Goes to the market', 'Reads with her classmates', 'After school, Linh plays badminton with her brother.'],
  ),
  'english-first-steps-2': listening(
    ['Hi, I’m Ben. What’s your name?', 'I’m Mai. I’m from Hue. Nice to meet you!', 'Nice to meet you too. Do you study here?', 'Yes. My English class starts at nine.'],
    ['Who is from Hue?', 'Mai', 'Ben', 'Their teacher', 'Mai introduces herself and says she is from Hue.'],
    ['When does Mai’s class start?', 'At nine', 'At eight', 'At ten', 'Her last sentence gives the start time.'],
  ),
  'english-first-steps-3': reading('Speak for 30–60 seconds about two things you like. Say why you like them and give an example of when you enjoy each one. You can start with “I like … because …”.'),
  'english-first-steps-4': reading('Write 60–90 words about a normal weekday. Describe your morning, afternoon and evening. Use sequence words such as first, then and finally.'),
  'stories-around-us-1': reading(
    'Every Saturday, Nora works in a little garden behind her flat. She grows mint and tomatoes in old buckets. Last summer, the tomatoes stopped growing because the buckets were in the shade. Nora moved them to a sunny wall. A month later she picked enough tomatoes to share with her neighbor.',
    ['Why did the tomatoes stop growing?', 'They did not get enough sun', 'The buckets were too new', 'Nora picked them too early', 'The buckets were in the shade before Nora moved them.'],
    ['Who received some tomatoes?', 'Nora’s neighbor', 'Her teacher', 'A shopkeeper', 'Nora shared the tomatoes with her neighbor.'],
  ),
  'stories-around-us-2': reading(
    'The weekend market opens at seven, but Sam arrives at eight. By then, the fresh bread stall has sold most of its loaves. Sam buys peaches, eggs and the last loaf of rye bread. He pays less than at the supermarket because he buys fruit that is slightly bruised.',
    ['When does Sam arrive?', 'At eight', 'At seven', 'At noon', 'The market opens at seven, and Sam arrives an hour later.'],
    ['Why does Sam spend less on fruit?', 'The fruit has small bruises', 'A friend pays for it', 'All the stalls are closing', 'Slightly bruised fruit costs less.'],
  ),
  'stories-around-us-3': reading(
    'Dear An, I have been in London for two weeks. I used to take the bus, but now I walk to class along the river. It takes longer, but I see more of the city. I plan to visit the science museum next Sunday. Let me know if you would like a postcard. Love, Jane.',
    ['How does Jane go to class now?', 'She walks', 'She takes the bus', 'She cycles', 'She used to take the bus, but now she walks.'],
    ['Where does Jane plan to go on Sunday?', 'The science museum', 'A train station', 'A library', 'The final part of her letter describes Sunday’s plan.'],
  ),
  'stories-around-us-4': reading(
    'At a busy bus stop, a man dropped his papers. The people nearby were in a hurry. Eli stopped to help gather the papers before the wind blew them away. The man thanked Eli, and another passenger offered to hold the bus door. All three got on together.',
    ['Why did Eli stop?', 'To help collect the papers', 'To buy a ticket', 'To ask for directions', 'Eli helped gather papers that the man dropped.'],
    ['What did another passenger do?', 'Held the bus door', 'Collected the ticket fare', 'Left the bus stop', 'The passenger offered to hold the door so they could board.'],
  ),
  'listen-to-life-1': listening(
    ['Hi, my name is Anna. I just moved here.', 'I’m Tom. Welcome! Which class are you in?', 'Class A. I start on Monday.', 'So do I. Let’s go together.'],
    ['Which class is Anna in?', 'Class A', 'Class B', 'Class C', 'Anna says “Class A”.'],
    ['What day do the students start?', 'Monday', 'Tuesday', 'Friday', 'Anna starts on Monday and Tom does too.'],
  ),
  'listen-to-life-2': listening(
    ['Excuse me, which platform is the train to Bristol?', 'Platform four. The train leaves at eleven fifteen.', 'Is the train on time?', 'No. It is ten minutes late today.'],
    ['Which platform should the traveler use?', 'Four', 'Two', 'Ten', 'The employee says “Platform four”.'],
    ['How late is the train?', 'Ten minutes', 'Four minutes', 'Fifteen minutes', 'The train is ten minutes late.'],
  ),
  'listen-to-life-3': listening(
    ['Good morning. Today will be bright in the east.', 'In the west, heavy rain will arrive after lunch.', 'The temperature will rise to twenty degrees.', 'Take a jacket if you plan to go out this evening.'],
    ['When will rain arrive in the west?', 'After lunch', 'Early in the morning', 'At midnight', 'The forecast says it will arrive after lunch.'],
    ['What does the speaker suggest bringing?', 'A jacket', 'A hat', 'A bottle of water', 'The speaker recommends a jacket for the evening.'],
  ),
  'listen-to-life-4': listening(
    ['Are you free on Saturday morning?', 'I have a driving lesson then. What about the afternoon?', 'Great. Meet me outside the library at three.', 'I’ll be there. Bring the book we talked about.'],
    ['Why is the second speaker busy in the morning?', 'A driving lesson', 'A library visit', 'A family lunch', 'The speaker has a driving lesson.'],
    ['Where will they meet?', 'Outside the library', 'Inside a bookshop', 'At the driving school', 'The meeting is outside the library at three.'],
  ),
  'speak-with-confidence-1': reading('You are ordering a drink at a café. Greet the barista, ask whether they have oat milk, order a drink and ask for the price. Speak naturally for 30–60 seconds.'),
  'speak-with-confidence-2': reading('A visitor wants to find a train station. Give directions from your school or home. Use landmarks and phrases such as turn left, go straight and across from. Speak for 45–60 seconds.'),
  'speak-with-confidence-3': reading('Imagine that you have just met a new classmate. Introduce yourself, share one interest and ask two open-ended questions to keep the conversation going.'),
  'speak-with-confidence-4': reading('Tell a friend about your last weekend. Include where you went, who was with you and one detail that surprised you. Use the past tense and speak for about one minute.'),
  'writing-little-stories-1': reading('Write an introduction for a new English class. In 80–120 words, describe your background, a hobby and a specific goal for the class.'),
  'writing-little-stories-2': reading('Write a friendly 90–130 word email inviting a friend to a weekend event. Include the time, meeting point, one reason to come and a question asking them to reply.'),
  'writing-little-stories-3': reading('Describe your favorite place in 100–150 words. Include two sensory details and explain why the place matters to you. Use a clear opening and closing.'),
  'writing-little-stories-4': reading('Write 120–170 words about an unforgettable day. Explain what happened, how you felt and what you learned. Use the past tense and a clear sequence of events.'),
};
