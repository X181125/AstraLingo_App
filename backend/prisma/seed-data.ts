import { PrismaClient, ContentType } from '@prisma/client';
import { hash } from 'bcryptjs';

export async function seed(db: PrismaClient, demo = false) {
  const categories = [
    { id: 'all-skills', name: 'Tổng hợp', icon: 'planet-outline', color: '#7454D6', order: 0 },
    { id: 'reading', name: 'Đọc hiểu', icon: 'book-outline', color: '#4E8E72', order: 1 },
    { id: 'listening', name: 'Nghe hiểu', icon: 'headset-outline', color: '#DE9653', order: 2 },
    { id: 'speaking', name: 'Luyện nói', icon: 'mic-outline', color: '#B76A92', order: 3 },
    { id: 'writing', name: 'Luyện viết', icon: 'pencil-outline', color: '#658DC3', order: 4 },
  ];
  for (const category of categories) await db.category.upsert({ where: { id: category.id }, create: category, update: category });
  const courses = [
    { id: 'english-first-steps', title: 'Tiếng Anh từ bước đầu', description: 'Một khởi đầu nhẹ nhàng. Làm quen với lời chào, giới thiệu bản thân và những câu nói hằng ngày.', categoryId: 'all-skills', language: 'en', level: 'A1', accent: '#E9E3FB', illustration: 'planet', featured: true, topics: ['Hello, world!', 'Giới thiệu bản thân', 'Những điều tôi thích', 'Một ngày của tôi'] },
    { id: 'speak-with-confidence', title: 'Tự tin nói mỗi ngày', description: 'Luyện những tình huống gần gũi: gọi món, hỏi đường và trò chuyện cùng bạn mới.', categoryId: 'speaking', language: 'en', level: 'A2', accent: '#FCE5D7', illustration: 'chat', featured: true, topics: ['Một tách cà phê', 'Hỏi đường thật dễ', 'Gặp một người bạn', 'Kể về cuối tuần'] },
    { id: 'stories-around-us', title: 'Đọc những điều thú vị', description: 'Khám phá thế giới qua những mẩu chuyện ngắn, mở rộng từ vựng và đọc hiểu ý chính.', categoryId: 'reading', language: 'en', level: 'A2', accent: '#DEF0E5', illustration: 'book', featured: true, topics: ['A little garden', 'The weekend market', 'A letter from London', 'Small acts of kindness'] },
    { id: 'listen-to-life', title: 'Lắng nghe cuộc sống', description: 'Làm quen âm thanh tiếng Anh với hội thoại ngắn và transcript dễ theo dõi.', categoryId: 'listening', language: 'en', level: 'A1', accent: '#FFF0CB', illustration: 'headphones', featured: false, topics: ['Nice to meet you', 'At the station', 'A weather forecast', 'Making plans'] },
    { id: 'writing-little-stories', title: 'Viết nên câu chuyện', description: 'Từ một câu đúng đến đoạn văn rõ ý. Thực hành giới thiệu, email và những câu chuyện nhỏ.', categoryId: 'writing', language: 'en', level: 'B1', accent: '#E3ECFC', illustration: 'pencil', featured: false, topics: ['A short introduction', 'An email to a friend', 'My favorite place', 'An unforgettable day'] },
  ];
  for (const { topics, ...course } of courses) {
    const data = { ...course, lessonsCount: topics.length, minutes: 40 };
    await db.course.upsert({ where: { id: course.id }, create: data, update: data });
    for (let index = 0; index < topics.length; index++) {
      const skill = { reading: 'READING', listening: 'LISTENING', speaking: 'SPEAKING', writing: 'WRITING' }[course.categoryId] ?? ['READING', 'LISTENING', 'SPEAKING', 'WRITING'][index];
      const lesson = { id: `${course.id}-${index + 1}`, courseId: course.id, title: topics[index], order: index + 1, minutes: 10, contentType: skill as ContentType,
        preview: `Bài ${index + 1}: ${topics[index]}. Mục tiêu: làm quen từ vựng theo ngữ cảnh và luyện kỹ năng ${skill.toLowerCase()}. Nội dung thực hành sẽ được triển khai ở giai đoạn Study.` };
      await db.contentItem.upsert({ where: { id: lesson.id }, create: lesson, update: lesson });
    }
  }
  if (demo) await db.user.upsert({ where: { email: 'demo@astralingo.app' }, update: {},
    create: { name: 'Minh Anh', email: 'demo@astralingo.app', passwordHash: await hash('Astra@12345', 12) },
  });
}
