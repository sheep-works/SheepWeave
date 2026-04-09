import { SheepDirector } from './services/core/SheepDirector';

// Global state instance for the extension
export const globalDirector = new SheepDirector();
export const globalShWvData = globalDirector.state;
