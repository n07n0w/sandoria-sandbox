(() => {
const content = document.getElementById('categoryImages');
const thumb = document.getElementById('scrollThumb');
const track = document.getElementById('scrollTrack');

function updateThumb() {
  const contentHeight = content.scrollHeight;
  const visibleHeight = content.clientHeight;
  const scrollTop = content.scrollTop;

  const thumbHeight = Math.max((visibleHeight / contentHeight) * visibleHeight, 20);
  const thumbTop = (scrollTop / contentHeight) * visibleHeight;

  thumb.style.height = `${thumbHeight}px`;
  thumb.style.top = `${thumbTop}px`;
}

// Прокрутка контента -> двигаем скроллбар
content.addEventListener('scroll', updateThumb);

// Обработка перетаскивания скроллбара
let isDragging = false;
let startY, startScrollTop;

thumb.addEventListener('mousedown', (e) => {
  isDragging = true;
  startY = e.clientY;
  startScrollTop = content.scrollTop;
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dy = e.clientY - startY;
  const contentHeight = content.scrollHeight;
  const visibleHeight = content.clientHeight;
  const scrollAmount = (dy / visibleHeight) * contentHeight;
  content.scrollTop = startScrollTop + scrollAmount;
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  document.body.style.userSelect = '';
});

// Инициализация
updateThumb();
window.addEventListener('resize', updateThumb);
})();