import { NativeModule, requireNativeModule } from 'expo';

declare class BlockingModule extends NativeModule<{}> {}

export default requireNativeModule<BlockingModule>('Blocking');
