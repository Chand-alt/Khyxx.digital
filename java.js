
const storedCart = JSON.parse(localStorage.getItem('khyxx-cart') || '[]');
const cart = Array.isArray(storedCart) ? storedCart : [];
const cartDrawer = document.querySelector('.cart-drawer');
const overlay = document.querySelector('.overlay');
const cartItems = document.querySelector('.cart-items');
const cartCount = document.querySelector('.cart-count');
const cartTotal = document.querySelector('.cart-total');
const productDetailsPanel = document.querySelector('.product-details-panel');
const productDetailsTitle = document.querySelector('#product-details-title');
const productDetailsType = document.querySelector('.product-details-type');
const productDetailsImage = document.querySelector('.product-details-image');
const productPreviewLink = document.querySelector('.product-preview-link');
const productInclusions = document.querySelector('.product-inclusions');
const detailsAddToCart = document.querySelector('.details-add-to-cart');
const header = document.querySelector('.site-header');
const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
let activeDetailsTrigger = null;

function saveCart() {
  localStorage.setItem('khyxx-cart', JSON.stringify(cart));
}

function formatPrice(value) { return `₱${value.toLocaleString()}`; }
function updateHeaderState() {
  header?.classList.toggle('scrolled', window.scrollY > 8);
}
function setActiveNavLink(sectionId) {
  navLinks.forEach(link => {
    const isActive = link.getAttribute('href') === `#${sectionId}`;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}
function updateActiveNavFromScroll() {
  const headerHeight = header?.getBoundingClientRect().height || 0;
  const scrollPosition = window.scrollY + headerHeight + 80;
  const sections = Array.from(document.querySelectorAll('main[id], section[id]'));

  let activeId = 'home';
  sections.forEach(section => {
    if (section.id && section.offsetTop <= scrollPosition) {
      activeId = section.id;
    }
  });

  setActiveNavLink(activeId);
}
function scrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return;
  const headerHeight = header?.getBoundingClientRect().height || 0;
  const top = window.pageYOffset + target.getBoundingClientRect().top - headerHeight - 12;
  window.scrollTo({ top, behavior: 'smooth' });
}
function renderCart() {
  const countEl = document.querySelector('.cart-count');
  const totalEl = document.querySelector('.cart-total');
  if (countEl) countEl.textContent = String(cart.length);
  if (totalEl) totalEl.textContent = formatPrice(cart.reduce((total, item) => total + item.price, 0));
  if (cartItems) {
    cartItems.innerHTML = cart.length ? cart.map((item, index) => `<div class="cart-line"><span>${item.name}<br><strong>${formatPrice(item.price)}</strong></span><button data-remove="${index}" aria-label="Remove ${item.name}">Remove</button></div>`).join('') : '<p class="empty">Your bag is waiting for something lovely.</p>';
  }
}
function toggleCart(open) {
  if (!cartDrawer || !overlay) return;
  if (open) toggleProductDetails(false);
  cartDrawer.classList.toggle('open', open);
  overlay.classList.toggle('visible', open);
  cartDrawer.setAttribute('aria-hidden', String(!open));
}

function toggleProductDetails(open, imageButton) {
  if (!productDetailsPanel || !overlay) return;
  if (open && imageButton) {
    activeDetailsTrigger = imageButton;
    productDetailsTitle.textContent = imageButton.dataset.detailsTitle;
    productDetailsType.textContent = imageButton.dataset.detailsType;
    if (imageButton.dataset.detailsImage) {
      productDetailsImage.src = imageButton.dataset.detailsImage;
      productDetailsImage.alt = `${imageButton.dataset.detailsTitle} preview`;
      productDetailsImage.hidden = false;
    } else {
      productDetailsImage.hidden = true;
    }
    if (imageButton.dataset.detailsPreview) {
      productPreviewLink.href = imageButton.dataset.detailsPreview;
      productPreviewLink.hidden = false;
    } else {
      productPreviewLink.hidden = true;
    }
    productInclusions.innerHTML = imageButton.dataset.inclusions
      .split('|')
      .map(inclusion => `<li>${inclusion}</li>`)
      .join('');
    detailsAddToCart.dataset.name = imageButton.closest('.product').querySelector('.add-to-cart').dataset.name;
    detailsAddToCart.dataset.price = imageButton.closest('.product').querySelector('.add-to-cart').dataset.price;
  }
  if (open) toggleCart(false);
  if (!open && productDetailsPanel.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  productDetailsPanel.classList.toggle('open', open);
  overlay.classList.toggle('visible', open);
  productDetailsPanel.setAttribute('aria-hidden', String(!open));
  if (!open) activeDetailsTrigger?.focus();
}

function addItemToCart(button) {
  const name = button.dataset.name;
  const price = Number(button.dataset.price);
  if (!name || Number.isNaN(price)) return;

  cart.push({ name, price });
  saveCart();
  renderCart();
  toggleCart(true);

  const originalText = button.textContent;
  button.textContent = 'Added to bag ✓';
  setTimeout(() => { button.textContent = originalText; }, 1200);
}

document.querySelectorAll('.add-to-cart').forEach(button => button.addEventListener('click', () => addItemToCart(button)));
document.querySelectorAll('.product-image[data-details-title]').forEach(imageButton => imageButton.addEventListener('click', () => toggleProductDetails(true, imageButton)));
detailsAddToCart?.addEventListener('click', () => addItemToCart(detailsAddToCart));
cartItems?.addEventListener('click', event => {
  if (event.target.dataset.remove !== undefined) {
    cart.splice(Number(event.target.dataset.remove), 1);
    saveCart();
    renderCart();
  }
});
document.querySelector('.cart-button')?.addEventListener('click', () => toggleCart(true));
document.querySelector('.close-cart')?.addEventListener('click', () => toggleCart(false));
document.querySelector('.close-details')?.addEventListener('click', () => toggleProductDetails(false));
overlay?.addEventListener('click', () => toggleCart(false));
overlay?.addEventListener('click', () => toggleProductDetails(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    toggleCart(false);
    toggleProductDetails(false);
  }
});
function showCheckoutForm() {
  if (!cart.length) return;
  const modal = document.createElement('div');
  modal.className = 'checkout-modal';
  modal.innerHTML = `<form class="checkout-form" aria-labelledby="checkout-title">
    <button class="close-checkout" type="button" aria-label="Close checkout">×</button>
    <div class="checkout-brand"><span>Khyxx</span> Digitals<small>secure checkout</small></div>
    <p class="eyebrow">secure checkout</p>
    <h2 id="checkout-title">Your details</h2>
    <p class="checkout-intro">Review your order, then choose how you would like to pay.</p>
    <label>Name<input required name="name" autocomplete="name" /></label>
    <label>Email<input required type="email" name="email" autocomplete="email" /></label>
    <fieldset class="payment-methods">
      <legend>Payment method</legend>
      <label class="payment-option"><input required type="radio" name="paymentMethod" value="bank_transfer" /> <span><strong>Bank transfer</strong><small>Pay directly from your bank account</small></span></label>
      <label class="payment-option"><input type="radio" name="paymentMethod" value="gcash" /> <span><strong>GCash</strong><small>Pay using your GCash wallet</small></span></label>
    </fieldset>
    <div class="checkout-summary"><div class="summary-heading">Your order <span>${cart.length} item${cart.length === 1 ? '' : 's'}</span></div>${cart.map(item => `<span>${item.name}<strong>${formatPrice(item.price)}</strong></span>`).join('')}<span class="summary-total"><b>Total</b><strong>${formatPrice(cart.reduce((total, item) => total + item.price, 0))}</strong></span></div>
    <p class="checkout-error" role="alert"></p>
    <button class="button button-dark" type="submit">Place order <span>→</span></button>
  </form>`;
  document.body.append(modal);
  const form = modal.querySelector('form');
  const error = modal.querySelector('.checkout-error');
  const close = () => modal.remove();
  modal.querySelector('.close-checkout').addEventListener('click', close);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Submitting order...';
    try {
      const paymentMethod = form.elements.paymentMethod.value;
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer: { name: form.elements.name.value, email: form.elements.email.value },
          paymentMethod,
          items: cart.map(item => ({ name: item.name, price: item.price, quantity: 1 }))
        })
      });
      const responseText = await response.text();
      let result = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error('Checkout backend is not running. Start the site with npm start.');
      }
      if (!response.ok || !result.orderId) throw new Error(result.error || 'Checkout is unavailable.');
      localStorage.removeItem('khyxx-cart');
      cart.length = 0;
      renderCart();
      close();
      showOrderDetailsForm(result.orderId, paymentMethod);
    } catch (checkoutError) {
      error.textContent = checkoutError.message;
      submit.disabled = false;
      submit.innerHTML = 'Place order <span>→</span>';
    }
  });
}

function showOrderDetailsForm(orderId, paymentMethod) {
  const modal = document.createElement('div');
  modal.className = 'checkout-modal order-details-modal';
  modal.innerHTML = `<form class="checkout-form order-details-form" aria-labelledby="details-title">
    <button class="close-checkout" type="button" aria-label="Close order details">×</button>
    <p class="eyebrow">one lovely next step</p>
    <h2 id="details-title">Tell us about your day</h2>
    <p class="checkout-intro">Order received. Share the details you want us to place on your wedding website or invitation.</p>
    <div class="details-fields">
      <label>Couple's names<input required name="coupleNames" placeholder="e.g. Amara & Theo" /></label>
      <label>Wedding date<input required type="date" name="weddingDate" /></label>
      <label>Venue or location<input required name="venue" placeholder="Venue name and address" /></label>
      <label>What should we include?<textarea required name="content" rows="3" placeholder="Welcome message, ceremony time, dress code, RSVP details, entourage, and other notes"></textarea></label>
    </div>
    <p class="checkout-error" role="alert"></p>
    <button class="button button-dark" type="submit">Send details <span>→</span></button>
    <p class="details-later">You can also send updates later to shintalkhye@gmail.com.</p>
  </form>`;
  document.body.append(modal);
  const form = modal.querySelector('form');
  const error = modal.querySelector('.checkout-error');
  const close = () => modal.remove();
  modal.querySelector('.close-checkout').addEventListener('click', close);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Sending details...';
    try {
      const response = await fetch('/api/order-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          coupleNames: form.elements.coupleNames.value,
          weddingDate: form.elements.weddingDate.value,
          venue: form.elements.venue.value,
          content: form.elements.content.value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not send your details.');
      modal.innerHTML = `<div class="checkout-form order-details-success"><p class="eyebrow">thank you</p><h2>Details received</h2><p class="checkout-intro">We will use your information for your order and contact you if we need anything else.</p><button class="button button-dark close-success" type="button">Done <span>→</span></button></div>`;
      modal.querySelector('.close-success').addEventListener('click', close);
    } catch (detailsError) {
      error.textContent = detailsError.message;
      submit.disabled = false;
      submit.innerHTML = 'Send details <span>→</span>';
    }
  });
}

async function captureReturnedPayment() {
  const params = new URLSearchParams(window.location.search);
  const paypalOrderId = params.get('paypalOrderId');
  const orderId = params.get('orderId');
  if (!paypalOrderId || !orderId) return;
  const response = await fetch('/api/paypal/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paypalOrderId, orderId })
  });
  if (!response.ok) return;
  localStorage.removeItem('khyxx-cart');
  document.querySelector('.order-confirmation')?.classList.remove('hidden');
  const confirmation = document.querySelector('.order-confirmation');
  if (confirmation) {
    confirmation.textContent = 'Payment received. Your order has been recorded.';
    confirmation.classList.add('visible');
  }
}

document.querySelector('.checkout')?.addEventListener('click', showCheckoutForm);
captureReturnedPayment().catch(error => console.error('Payment capture failed:', error));

function setActiveFilter(filterName) {
  const activeFilter = document.querySelector('.filter.active');
  const nextFilter = document.querySelector(`.filter[data-filter="${filterName}"]`);

  if (activeFilter) activeFilter.classList.remove('active');
  if (nextFilter) nextFilter.classList.add('active');

  document.querySelectorAll('.product').forEach(product => {
    const shouldShow = filterName === 'all' || product.dataset.category === filterName;
    product.classList.toggle('hidden', !shouldShow);
  });
}

document.querySelectorAll('.filter').forEach(filter => filter.addEventListener('click', () => {
  setActiveFilter(filter.dataset.filter);
}));

document.querySelector('.view-websites-link')?.addEventListener('click', event => {
  event.preventDefault();
  setActiveFilter('website');
  scrollToSection('shop');
  window.history.replaceState(null, '', '#shop');
});

document.querySelector('.view-invitations-link')?.addEventListener('click', event => {
  event.preventDefault();
  setActiveFilter('invitation');
  scrollToSection('shop');
  window.history.replaceState(null, '', '#shop');
});
const quotes = [
  ['“The invitation was even more beautiful than we imagined. Khyxx made the entire process feel effortless and so personal.”', '— Camille & Rafael'],
  ['“Our wedding site looked incredible and the RSVP tracker was a lifesaver. Every guest kept asking who designed it.”', '— Nina & Miguel'],
  ['“Beautiful, warm, and so easy to customise. It brought our whole vision together in an afternoon.”', '— Arielle & Sam'],
  ['“The design was exactly what we dreamed of, and our guests loved every little detail.”', '— Bea & Marco'],
  ['“So easy to personalise and beautifully made. It made our celebration feel even more special.”', '— Lara & Enzo']
];
let quoteIndex = 0;
let feedbackNextCount = 0;
function changeQuote(direction) { quoteIndex = (quoteIndex + direction + quotes.length) % quotes.length; document.querySelector('#quote-text').textContent = quotes[quoteIndex][0]; document.querySelector('#quote-author').textContent = quotes[quoteIndex][1]; }
document.querySelector('.next')?.addEventListener('click', () => {
  changeQuote(1);
  feedbackNextCount = (feedbackNextCount + 1) % quotes.length;
  document.querySelector('.feedback-gallery')?.classList.toggle('visible', feedbackNextCount !== 0);
});
document.querySelector('.previous')?.addEventListener('click', () => changeQuote(-1));
document.querySelectorAll('.nav a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const targetId = href.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    setActiveNavLink(targetId);
    scrollToSection(targetId);
    window.history.replaceState(null, '', href);
    document.querySelector('.nav')?.classList.remove('open');
  });
});

document.querySelector('.menu-toggle')?.addEventListener('click', event => { const nav = document.querySelector('.nav'); nav?.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(nav?.classList.contains('open'))); });
document.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', () => document.querySelector('.nav')?.classList.remove('open')));
document.querySelector('#contact-form')?.addEventListener('submit', event => { event.preventDefault(); event.currentTarget.reset(); document.querySelector('.form-status').textContent = 'Thank you — we’ll be in touch soon!'; });
window.addEventListener('scroll', () => {
  updateHeaderState();
  updateActiveNavFromScroll();
}, { passive: true });
window.addEventListener('load', () => {
  updateHeaderState();
  updateActiveNavFromScroll();
  setActiveNavLink('home');
  renderCart();
});
