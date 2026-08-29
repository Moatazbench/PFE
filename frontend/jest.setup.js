// Polyfill for TextEncoder/TextDecoder in Jest test environment
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, {
  TextEncoder,
  TextDecoder,
});
