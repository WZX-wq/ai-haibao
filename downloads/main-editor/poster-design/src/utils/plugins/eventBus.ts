import mitt from 'mitt';

type Events = {
  refreshUserImages: any;
  refreshUserDesigns: any;
  refreshTemplates: any;
};

const emitter = mitt<Events>();

export default emitter;
