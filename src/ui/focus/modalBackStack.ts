type CloseHandler = () => void;

const stack: CloseHandler[] = [];

export function pushModalBackHandler(handler: CloseHandler): () => void {
  stack.push(handler);
  return () => {
    const idx = stack.lastIndexOf(handler);
    if (idx !== -1) {
      stack.splice(idx, 1);
    }
  };
}

export function consumeModalBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

export function hasOpenModal(): boolean {
  return stack.length > 0;
}
