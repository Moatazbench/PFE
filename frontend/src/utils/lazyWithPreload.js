import { lazy } from 'react';

export default function lazyWithPreload(factory) {
  var Component = lazy(factory);
  Component.preload = factory;
  return Component;
}
