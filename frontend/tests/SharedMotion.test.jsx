import fs from 'fs';
import path from 'path';

test('shared animation system respects reduced motion', () => {
  const cssPath = path.join(process.cwd(), 'src', 'styles.css');
  const styles = fs.readFileSync(cssPath, 'utf8');

  expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  expect(styles).toContain('animation-duration: 0.01ms !important');
  expect(styles).toContain('transition-duration: 0.01ms !important');
});
