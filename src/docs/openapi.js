export const openApiDocument = {
    openapi: '3.0.3',
    info: {
        title: 'Biteyo API',
        version: '1.0.0',
        description: 'API documentation for Biteyo backend services.',
    },
    servers: [
        {
            url: 'https://biteyo-be.vercel.app',
            description: 'Production',
        },
        {
            url: 'http://localhost:8000',
            description: 'Local development',
        },
    ],
    tags: [
        { name: 'Auth' },
        { name: 'Feed' },
        { name: 'Profile' },
        { name: 'Notifications' },
        { name: 'Maps' },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                },
            },
            Pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 10 },
                    hasMore: { type: 'boolean', example: false },
                },
            },
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    username: { type: 'string', example: 'biteyo_user' },
                    email: { type: 'string', format: 'email' },
                    bio: { type: 'string', nullable: true },
                    avatarUrl: { type: 'string', nullable: true },
                    bannerUrl: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Bite: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    foodName: { type: 'string', example: 'Nasi Goreng' },
                    locationName: { type: 'string', example: 'Warung Makan Enak' },
                    locationAddress: { type: 'string', nullable: true },
                    latitude: { type: 'string', nullable: true, example: '-6.20000000' },
                    longitude: { type: 'string', nullable: true, example: '106.81666600' },
                    placeId: { type: 'string', nullable: true },
                    review: { type: 'string', nullable: true },
                    rating: { type: 'integer', minimum: 1, maximum: 5 },
                    photoUrl: { type: 'string' },
                    category: { $ref: '#/components/schemas/BiteCategory' },
                    viewsCount: { type: 'integer', example: 12 },
                    likesCount: { type: 'integer', example: 4 },
                    commentsCount: { type: 'integer', example: 2 },
                    viralScore: { type: 'integer', example: 34 },
                    isTrending: { type: 'boolean', example: true },
                    isLiked: { type: 'boolean', example: false },
                    isSaved: { type: 'boolean', example: false },
                    createdAt: { type: 'string', format: 'date-time' },
                    user: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', format: 'uuid' },
                            username: { type: 'string' },
                            avatarUrl: { type: 'string', nullable: true },
                        },
                    },
                },
            },
            BiteCategory: {
                type: 'string',
                enum: [
                    'street_food',
                    'cafe',
                    'fine_dining',
                    'dessert',
                    'viral',
                    'hidden_gems',
                ],
            },
            Comment: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    content: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    user: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', format: 'uuid' },
                            username: { type: 'string' },
                            avatarUrl: { type: 'string', nullable: true },
                        },
                    },
                },
            },
            Notification: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    type: {
                        type: 'string',
                        enum: ['like', 'comment', 'follow', 'trending'],
                    },
                    biteId: { type: 'string', format: 'uuid', nullable: true },
                    message: { type: 'string', nullable: true },
                    read: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
        },
        parameters: {
            Page: {
                name: 'page',
                in: 'query',
                schema: { type: 'integer', minimum: 1, default: 1 },
            },
            Limit: {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            },
        },
        responses: {
            Unauthorized: {
                description: 'Unauthorized',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                    },
                },
            },
            NotFound: {
                description: 'Resource not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                    },
                },
            },
            ServerError: {
                description: 'Server error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                    },
                },
            },
        },
    },
    paths: {
        '/': {
            get: {
                tags: ['Health'],
                summary: 'API health check',
                responses: {
                    200: { description: 'API running' },
                },
            },
        },
        '/api/auth/signup': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new user',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['username', 'email', 'password', 'confirm_password'],
                                properties: {
                                    username: { type: 'string', minLength: 3, maxLength: 30 },
                                    email: { type: 'string', format: 'email' },
                                    password: { type: 'string', minLength: 8, maxLength: 64 },
                                    confirm_password: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'User registered' },
                    400: { description: 'Validation error' },
                    500: { $ref: '#/components/responses/ServerError' },
                },
            },
        },
        '/api/auth/signin': {
            post: {
                tags: ['Auth'],
                summary: 'Sign in',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    password: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Signed in successfully' },
                    400: { description: 'Validation error' },
                    500: { $ref: '#/components/responses/ServerError' },
                },
            },
        },
        '/api/auth/google': {
            post: {
                tags: ['Auth'],
                summary: 'Sign in with Google ID token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['id_token'],
                                properties: {
                                    id_token: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Signed in successfully' },
                    400: { description: 'Validation error' },
                    500: { $ref: '#/components/responses/ServerError' },
                },
            },
        },
        '/api/auth/forgot-password': {
            post: {
                tags: ['Auth'],
                summary: 'Request password reset email',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email'],
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Reset email sent' },
                    400: { description: 'Validation error' },
                    500: { $ref: '#/components/responses/ServerError' },
                },
            },
        },
        '/api/auth/reset-password/{token}': {
            post: {
                tags: ['Auth'],
                summary: 'Reset password',
                parameters: [
                    {
                        name: 'token',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['password', 'confirm_password'],
                                properties: {
                                    password: { type: 'string', minLength: 8, maxLength: 64 },
                                    confirm_password: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Password reset successfully' },
                    400: { description: 'Validation error' },
                    500: { $ref: '#/components/responses/ServerError' },
                },
            },
        },
        '/api/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Logout',
                responses: {
                    200: { description: 'Logged out successfully' },
                },
            },
        },
        '/api/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Get authenticated user',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Authenticated user' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/categories': {
            get: {
                tags: ['Feed'],
                summary: 'List bite categories',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Category list' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/bites': {
            get: {
                tags: ['Feed'],
                summary: 'List bites',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: '#/components/parameters/Page' },
                    { $ref: '#/components/parameters/Limit' },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string', enum: ['latest', 'trending', 'viral'] },
                    },
                    {
                        name: 'category',
                        in: 'query',
                        schema: { $ref: '#/components/schemas/BiteCategory' },
                    },
                    {
                        name: 'trending',
                        in: 'query',
                        schema: { type: 'boolean' },
                    },
                    {
                        name: 'q',
                        in: 'query',
                        description: 'Search food_name, location_name, or review.',
                        schema: { type: 'string' },
                    },
                    {
                        name: 'search',
                        in: 'query',
                        description: 'Alias for q.',
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: {
                        description: 'Bite list',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Bite' },
                                        },
                                        pagination: { $ref: '#/components/schemas/Pagination' },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
            post: {
                tags: ['Feed'],
                summary: 'Create a bite',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['foodName', 'locationName', 'rating', 'category', 'photo'],
                                properties: {
                                    foodName: { type: 'string', minLength: 2, maxLength: 64 },
                                    locationName: { type: 'string', minLength: 2, maxLength: 255 },
                                    locationAddress: { type: 'string', maxLength: 500 },
                                    latitude: { type: 'number' },
                                    longitude: { type: 'number' },
                                    placeId: { type: 'string' },
                                    review: { type: 'string', maxLength: 1000 },
                                    rating: { type: 'integer', minimum: 1, maximum: 5 },
                                    category: { $ref: '#/components/schemas/BiteCategory' },
                                    photo: { type: 'string', format: 'binary' },
                                    image: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Bite created' },
                    400: { description: 'Validation error' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    500: { $ref: '#/components/responses/ServerError' },
                },
            },
        },
        '/api/feed/bites/search': {
            get: {
                tags: ['Feed'],
                summary: 'Search bites',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: '#/components/parameters/Page' },
                    { $ref: '#/components/parameters/Limit' },
                    {
                        name: 'q',
                        in: 'query',
                        schema: { type: 'string' },
                        required: false,
                    },
                    {
                        name: 'search',
                        in: 'query',
                        schema: { type: 'string' },
                        required: false,
                    },
                ],
                responses: {
                    200: { description: 'Search results' },
                    400: { description: 'Search query is required' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/bites/trending': {
            get: {
                tags: ['Feed'],
                summary: 'List trending bites',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: '#/components/parameters/Page' },
                    { $ref: '#/components/parameters/Limit' },
                ],
                responses: {
                    200: { description: 'Trending bites' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/bites/category/{category}': {
            get: {
                tags: ['Feed'],
                summary: 'List bites by category',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'category',
                        in: 'path',
                        required: true,
                        schema: { $ref: '#/components/schemas/BiteCategory' },
                    },
                    { $ref: '#/components/parameters/Page' },
                    { $ref: '#/components/parameters/Limit' },
                ],
                responses: {
                    200: { description: 'Bites in category' },
                    400: { description: 'Invalid category' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/bites/{id}': {
            get: {
                tags: ['Feed'],
                summary: 'Get bite detail',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    200: { description: 'Bite detail' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
            patch: {
                tags: ['Feed'],
                summary: 'Update bite',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    foodName: { type: 'string', minLength: 2, maxLength: 64 },
                                    review: { type: 'string', maxLength: 1000 },
                                    rating: { type: 'integer', minimum: 1, maximum: 5 },
                                    category: { $ref: '#/components/schemas/BiteCategory' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Bite updated' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
            delete: {
                tags: ['Feed'],
                summary: 'Delete bite',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    200: { description: 'Bite deleted' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/bites/{id}/view': {
            post: {
                tags: ['Feed'],
                summary: 'Record a bite view',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    200: { description: 'View recorded' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/bites/{id}/like': {
            post: {
                tags: ['Feed'],
                summary: 'Toggle like on a bite',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    200: { description: 'Bite unliked' },
                    201: { description: 'Bite liked' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/bites/{id}/save': {
            post: {
                tags: ['Feed'],
                summary: 'Toggle saved state on a bite',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    200: { description: 'Bite unsaved' },
                    201: { description: 'Bite saved' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/feed/bites/{id}/comments': {
            get: {
                tags: ['Feed'],
                summary: 'List bite comments',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    200: { description: 'Comment list' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
            post: {
                tags: ['Feed'],
                summary: 'Create bite comment',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['content'],
                                properties: {
                                    content: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Comment created' },
                    400: { description: 'Comment is required' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/profile/saved': {
            get: {
                tags: ['Profile'],
                summary: 'List authenticated user saved bites',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Saved bites' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/profile/liked': {
            get: {
                tags: ['Profile'],
                summary: 'List authenticated user liked bites',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Liked bites' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/profile/{username}': {
            get: {
                tags: ['Profile'],
                summary: 'Get user profile',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'username',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'Profile detail' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/profile/{username}/bites': {
            get: {
                tags: ['Profile'],
                summary: 'List user bites',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'username',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                    { $ref: '#/components/parameters/Page' },
                    { $ref: '#/components/parameters/Limit' },
                ],
                responses: {
                    200: { description: 'User bites' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/profile/{username}/liked': {
            get: {
                tags: ['Profile'],
                summary: 'List bites liked by username',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'username',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'User liked bites' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/profile/{username}/likes': {
            get: {
                tags: ['Profile'],
                summary: 'Alias for user liked bites',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'username',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'User liked bites' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/profile/{username}/follow': {
            post: {
                tags: ['Profile'],
                summary: 'Follow a user',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'username',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'User followed' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
            delete: {
                tags: ['Profile'],
                summary: 'Unfollow a user',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'username',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'User unfollowed' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/profile': {
            patch: {
                tags: ['Profile'],
                summary: 'Update authenticated user profile',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    username: { type: 'string', minLength: 3, maxLength: 30 },
                                    bio: { type: 'string', maxLength: 255 },
                                    avatar: { type: 'string', format: 'binary' },
                                    profileImage: { type: 'string', format: 'binary' },
                                    banner: { type: 'string', format: 'binary' },
                                    bannerImage: { type: 'string', format: 'binary' },
                                    cover: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Profile updated' },
                    400: { description: 'Validation error' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
            delete: {
                tags: ['Profile'],
                summary: 'Delete authenticated user account',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Account deleted' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/notifications': {
            get: {
                tags: ['Notifications'],
                summary: 'List notifications',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: '#/components/parameters/Page' },
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
                    },
                ],
                responses: {
                    200: { description: 'Notification list' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/notifications/fcm-token': {
            post: {
                tags: ['Notifications'],
                summary: 'Register FCM token',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['token'],
                                properties: {
                                    token: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'FCM token registered' },
                    400: { description: 'FCM token is required' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
            delete: {
                tags: ['Notifications'],
                summary: 'Unregister FCM token',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['token'],
                                properties: {
                                    token: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'FCM token removed' },
                    400: { description: 'FCM token is required' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/notifications/{id}/read': {
            patch: {
                tags: ['Notifications'],
                summary: 'Mark notification as read',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    200: { description: 'Notification marked as read' },
                    404: { $ref: '#/components/responses/NotFound' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/maps/location/search': {
            get: {
                tags: ['Maps'],
                summary: 'Search location',
                parameters: [
                    {
                        name: 'q',
                        in: 'query',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: {
                        description: 'Location search results',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            placeId: { type: 'integer' },
                                            name: { type: 'string' },
                                            lat: { type: 'number' },
                                            lng: { type: 'number' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    500: { $ref: '#/components/responses/ServerError' },
                },
            },
        },
    },
};
