import { registerWebModule, NativeModule } from 'expo';

class BlockingModule extends NativeModule<{}> {}

export default registerWebModule(BlockingModule, 'BlockingModule');
