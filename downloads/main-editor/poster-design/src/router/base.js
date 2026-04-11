export default [
    {
        path: '/',
        name: 'main',
        redirect: 'welcome',
    },
    {
        path: '/welcome',
        name: 'Welcome',
        component: () => import('@/views/Welcome.vue'),
    },
    {
        path: '/home',
        name: 'Home',
        component: () => import('@/views/Index.vue'),
    },
    {
        path: '/create',
        name: 'Create',
        component: () => import('@/views/AiPoster.vue'),
    },
    {
        path: '/ai-poster',
        name: 'AiPoster',
        component: () => import('@/views/AiPoster.vue'),
    },
    {
        path: '/draw',
        name: 'Draw',
        component: () => import('@/views/Draw.vue'),
    },
    {
        path: '/html',
        name: 'Html',
        component: () => import('@/views/Html.vue'),
    },
    {
        path: '/psd',
        name: 'Psd',
        component: () => import('@/views/Psd.vue'),
    },
];
//# sourceMappingURL=base.js.map
