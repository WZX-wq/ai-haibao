import mitt from 'mitt';

type Events = {
  refreshUserImages: any;
  refreshUserDesigns: any;
};

const emitter = mitt<Events>();

export default emitter;
