type Schema = Record<string, unknown>;
type Method = 'get' | 'post' | 'put' | 'patch';
type Operation = {
  summary: string;
  public?: boolean;
  body?: { schema: Schema; required?: boolean };
  response?: Schema;
  parameters?: Record<string, unknown>[];
  statuses?: number[];
  ai?: boolean;
};
const object = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({
  type: 'object',
  properties,
  required,
});
const string = { type: 'string' };
const integer = { type: 'integer' };
const positiveId = { type: 'integer', minimum: 1, maximum: 2147483647 };
const sampleObject = { type: 'object', additionalProperties: true };
const array = (items: Schema) => ({ type: 'array', items });
const choice = (...values: string[]) => ({ type: 'string', enum: values });
const reference = (name: string) => ({ $ref: '#/components/schemas/' + name });
const requestBody = (schema: Schema) => ({ schema });
const json = (schema: Schema) => ({ 'application/json': { schema } });
const page = { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } };
const query = { in: 'query', name: 'q', schema: { type: 'string', maxLength: 100 } };

const preparation = [
  'brainstorm',
  'outline',
  'analyze',
  'vocab-pack',
  'translate',
  'simplify',
  'thesis',
  'topic-sentences',
  'examples',
  'phrase-bank',
  'checklist',
];
const revision = [
  'grammar-check',
  'spell-check',
  'coherence-check',
  'improve',
  'lexical-upgrade',
  'task-response-check',
  'sentence-rewrite',
  'paragraph-feedback',
  'change-tone',
  'expand',
  'shorten',
  'coach-chat',
];
const paths: Record<string, Record<string, unknown>> = {};
function document(method: Method, path: string, operation: Operation) {
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
    in: 'path',
    name,
    required: true,
    schema:
      name === 'publicId'
        ? positiveId
        : name === 'draftTask'
          ? choice(...revision)
          : name === 'preparationTask'
            ? choice(...preparation)
            : name === 'analysis'
              ? choice(
                  'band-estimate',
                  'error-map',
                  'improved-version',
                  'paragraph-breakdown',
                  'vocab-analysis',
                  'grammar-analysis',
                  'cohesion-analysis',
                  'task-achievement',
                )
              : string,
  }));
  const response = object({ success: { const: true }, data: operation.response ?? sampleObject });
  const statuses = new Set([
    ...(operation.statuses ?? [200]),
    400,
    ...(operation.public ? [] : [401]),
    ...(operation.ai ? [429, 502, 503] : []),
  ]);
  paths[path] ??= {};
  paths[path][method] = {
    summary: operation.summary,
    ...(operation.public && { security: [] }),
    parameters: [...parameters, ...(operation.parameters ?? [])],
    ...(operation.body && {
      requestBody: { required: operation.body.required !== false, content: json(operation.body.schema) },
    }),
    responses: Object.fromEntries(
      [...statuses].map((status) => [
        String(status),
        status < 400
          ? { description: status === 201 ? 'Đã tạo' : 'Thành công', content: json(response) }
          : { $ref: '#/components/responses/Error' },
      ]),
    ),
  };
}

const email = { type: 'string', format: 'email' };
const credentials = object(
  {
    email,
    password: { type: 'string', format: 'password' },
    supportsRefresh: { type: 'boolean', default: false },
  },
  ['email', 'password'],
);
document('get', '/health', {
  summary: 'Kiểm tra kết nối cơ sở dữ liệu',
  public: true,
  response: object({ status: string, app: string, database: string }),
});
document('post', '/auth/login', {
  summary: 'Đăng nhập',
  public: true,
  statuses: [200, 401, 429],
  body: requestBody(credentials),
  response: reference('Session'),
});
document('post', '/auth/register', {
  summary: 'Đăng ký',
  public: true,
  statuses: [201, 409, 429],
  body: requestBody(
    object(
      {
        email,
        password: { ...string, minLength: 8 },
        name: { ...string, minLength: 2, maxLength: 60 },
        supportsRefresh: { type: 'boolean' },
      },
      ['name', 'email', 'password'],
    ),
  ),
  response: reference('Session'),
});
document('post', '/auth/forgot-password', {
  summary: 'Yêu cầu mã đặt lại mật khẩu',
  public: true,
  statuses: [200, 429],
  body: requestBody(object({ email: { ...string, format: 'email' } })),
});
document('post', '/auth/reset-password', {
  summary: 'Đặt lại mật khẩu bằng mã xác nhận',
  public: true,
  statuses: [200, 429],
  body: requestBody(
    object({
      email: { ...string, format: 'email' },
      code: { ...string, pattern: '^[0-9]{6}$' },
      password: { ...string, minLength: 8 },
    }),
  ),
});
document('post', '/auth/refresh', {
  summary: 'Làm mới phiên và thay refresh token',
  public: true,
  statuses: [200, 401, 429],
  body: requestBody(object({ refreshToken: string })),
  response: reference('Session'),
});
document('get', '/categories', { summary: 'Danh mục khóa học', public: true, response: array(sampleObject) });
document('get', '/courses', {
  summary: 'Tìm khóa học tiếng Anh',
  public: true,
  parameters: [
    page,
    query,
    { in: 'query', name: 'category', schema: string },
    { in: 'query', name: 'level', schema: choice('A1', 'A2', 'B1', 'B2') },
  ],
  response: object({
    items: array(sampleObject),
    total: integer,
    page: integer,
    hasMore: { type: 'boolean' },
  }),
});
document('get', '/courses/{id}', { summary: 'Chi tiết khóa học', public: true, statuses: [200, 404] });
document('post', '/courses/{id}/enroll', { summary: 'Ghi danh khóa học', statuses: [200, 404] });
document('get', '/account/progress', { summary: 'Xem tiến độ và chuỗi ngày học' });
document('get', '/study/lessons', {
  summary: 'Danh sách bài luyện',
  parameters: [
    page,
    query,
    { in: 'query', name: 'skill', schema: choice('READING', 'LISTENING', 'SPEAKING', 'WRITING') },
  ],
  response: reference('Page'),
});
document('get', '/study/lessons/{id}', {
  summary: 'Chi tiết bài luyện theo mã số hoặc slug',
  statuses: [200, 404],
});
document('get', '/listening-audios/{publicId}/related', {
  summary: 'Gợi ý bài nghe đã xuất bản theo khóa học và trình độ',
  statuses: [200, 404],
  parameters: [{ in: 'query', name: 'limit', schema: { ...positiveId, maximum: 30, default: 5 } }],
  response: object({
    items: array(
      object({
        id: positiveId,
        reason: choice('SAME_COURSE', 'SAME_LEVEL', 'MORE_LISTENING'),
        contentItem: object({ title: string, description: string }),
      }),
    ),
    basePrompt: sampleObject,
  }),
});
document('post', '/listening-attempts/{publicId}/weakness-analysis', {
  summary: 'Phân tích lỗi sau khi nộp bài nghe',
  ai: true,
  statuses: [200, 404, 409],
  response: object({ attemptId: positiveId, text: string }),
});
document('get', '/learn/ai/capabilities', {
  summary: 'Trạng thái cấu hình Gemini',
  response: object({ gemini: { type: 'boolean' } }),
});
document('post', '/writing-prompts/{publicId}/ai/{preparationTask}', {
  summary: 'Hỗ trợ chuẩn bị bài viết',
  ai: true,
  statuses: [200, 404],
  body: { schema: sampleObject, required: false },
  response: reference('TutorReply'),
});
document('post', '/writing-prompts/{publicId}/ai/draft/{draftTask}', {
  summary: 'Góp ý bản nháp đang soạn. Đổi giọng văn và hỏi trợ lý cần trường context.',
  ai: true,
  statuses: [200, 404, 413],
  body: requestBody(
    object({ text: { ...string, minLength: 1, maxLength: 15000 }, context: { ...string, maxLength: 1500 } }, [
      'text',
    ]),
  ),
  response: reference('TutorReply'),
});
document('get', '/writing-submissions/{publicId}/ai/{analysis}', {
  summary: 'Xem phân tích bài viết đã chấm',
  ai: true,
  statuses: [200, 404, 409],
});
document('post', '/study/attempts/{id}/feedback', {
  summary: 'Chấm bài nói hoặc bài viết đã nộp',
  ai: true,
  statuses: [200, 409],
});
document('get', '/learn/dictionary', {
  summary: 'Tra từ tiếng Anh. Khi có page, trả về danh sách phân trang.',
  parameters: [query, page],
  response: {
    oneOf: [
      array(reference('Word')),
      object({ items: array(reference('Word')), total: integer, hasMore: { type: 'boolean' } }),
    ],
  },
});
document('get', '/learn/decks', {
  summary: 'Danh sách bộ thẻ',
  parameters: [page, query, { in: 'query', name: 'view', schema: choice('mine', 'explore') }],
  response: reference('Page'),
});
document('post', '/learn/cards/{id}/review', {
  summary: 'Lưu kết quả ôn thẻ',
  statuses: [200, 404, 409],
  body: requestBody(object({ answer: choice('again', 'hard', 'good', 'easy') })),
});
document('get', '/exams', {
  summary: 'Danh sách đề thi và quiz',
  public: true,
  response: array(sampleObject),
});
document('post', '/exams/{id}/start', { summary: 'Bắt đầu lượt thi', statuses: [200, 201, 404] });
document('put', '/exams/attempts/{id}/answers', {
  summary: 'Lưu câu trả lời trong lượt thi',
  statuses: [200, 404, 409],
  body: requestBody(object({ question: integer, choice: integer, revision: integer })),
});
document('post', '/exams/attempts/{id}/submit', {
  summary: 'Nộp đề và nhận điểm',
  statuses: [200, 404, 409],
});

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'AstraLingo API',
    version: '1.0.0',
    description:
      'Hợp đồng của các luồng chính và công cụ viết, nghe. Danh sách đầy đủ đường dẫn tương thích di động nằm trong backend/test/mobile-routes.json.',
  },
  servers: [{ url: '/api' }],
  security: [{ bearerAuth: [] }],
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Session: object({ user: sampleObject, token: string, refreshToken: string }, ['user', 'token']),
      Page: object({ items: array(sampleObject), hasMore: { type: 'boolean' } }),
      TutorReply: object({ text: string }),
      Word: object({ word: string, meaning: string, example: { type: ['string', 'null'] } }, [
        'word',
        'meaning',
      ]),
    },
    responses: {
      Error: {
        description: 'Yêu cầu thất bại',
        content: json(object({ error: object({ status: integer, message: string }) })),
      },
    },
  },
};
