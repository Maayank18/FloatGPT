import assert from 'node:assert/strict';
import { comparePrices, formatInr, offerMatches, parseAmazonSearch, parseAptronixSearch, parseFlipkartSearch, parsePagePrice, parsePoorvikaSearch, parseWebLeads, rupees } from './priceCompare';

assert.equal(rupees('1,79,900'), 179900);
assert.equal(rupees('178,900.00'), 178900);
assert.equal(offerMatches('iPhone 18 Pro', 'iphone 18 pro max'), false);
assert.equal(offerMatches('iPhone 18 Pro Max silicone case', 'iphone 18 pro max'), false);
assert.equal(offerMatches('Apple iPhone 18 Pro Max (256 GB)', 'iphone 18 pro max'), true);

const amazon = `
<div data-asin="B0CASEITEM" data-component-type="s-search-result">
  <h2><a href="/dp/B0CASEITEM"><span>iPhone 18 Pro Max clear case</span></a></h2>
  <span class="a-offscreen">₹1,999</span>
</div>
<div data-asin="B0HJ9XZ74M" data-component-type="s-search-result">
  <h2><a href="javascript:void(0)"><span>4.6 out of 5 stars</span><span>iPhone 18 Pro Max (256 GB) - Black</span></a></h2>
  <span class="a-offscreen">₹1,79,900</span>
  <span class="a-offscreen">M.R.P: ₹1,99,900</span>
</div>
<div data-asin="B0OLDERPHONE" data-component-type="s-search-result">
  <h2><a href="/dp/B0OLDERPHONE"><span>iPhone 16 Pro Max (256 GB)</span></a></h2>
  <span class="a-offscreen">₹1,34,900</span>
</div>`;
const amazonOffer = parseAmazonSearch(amazon, 'iphone 18 pro max');
assert.equal(amazonOffer?.price, 179900);
assert.equal(amazonOffer?.url, 'https://www.amazon.in/dp/B0HJ9XZ74M');

const amazonAlt = `
<div data-asin="B0GL8FNY5G" data-component-type="s-search-result">
  <h2><span>Samsung</span></h2>
  <img alt="Sponsored Ad - Samsung Galaxy S26 Ultra 5G (Black, 256GB Storage)" />
  <span class="a-offscreen">₹1,39,999</span>
</div>`;
assert.equal(parseAmazonSearch(amazonAlt, 'samsung s26 ultra')?.price, 139999);

const flipkart = `
<a href="/apple-iphone-18-pro-max-glacier-256-gb/p/itm09c62f5b365e6?pid=1" class="x">
<div class="RG5Slk">Apple iPhone 18 Pro max (Glacier, 256 GB)</div>
<div>₹1,79,900</div></a>
<a href="/apple-iphone-16-pro-max-black-titanium-256-gb/p/itm7e75db4f27bd5">
<div class="RG5Slk">Apple iPhone 16 Pro Max (Black Titanium, 256 GB)</div>
<div>₹1,34,900</div></a>`;
assert.equal(parseFlipkartSearch(flipkart, 'iphone 18 pro max')?.price, 179900);

const flipkartGrid = `
<a class="pIpigb" title="Cadbury Dairy Milk Silk Chocolate Bar" href="/cadbury-dairy-milk-silk-chocolate-bar/p/itmc079831f0ff0c?pid=1">Cadbury Dairy Milk Silk Chocolate Bar</a>
<div class="hZ3P6w">₹350</div>`;
assert.equal(parseFlipkartSearch(flipkartGrid, 'cadbury dairy milk silk')?.price, 350);

const poorvika = `
<a href="/apple-iphone-18-pro-max-glacier-2tb/p"><b>Apple iPhone 18 Pro Max ( Glacier, 2TB )</b>
<span>₹ 3,29,900</span></a>
<a href="/apple-iphone-18-pro-max-glacier-256gb/p"><b>Apple iPhone 18 Pro Max ( Glacier, 256GB )</b>
<span class="ml-1">₹ 1,79,900</span></a>`;
const poor = parsePoorvikaSearch(poorvika, 'iphone 18 pro max');
assert.equal(poor?.price, 179900);
assert.equal(poor?.url, 'https://www.poorvika.com/apple-iphone-18-pro-max-glacier-256gb/p');

const aptronix = `
<span>The highest price is ₹ 449,900.00</span>
<a href="/products/iphone-18-pro-max?_pos=1" class="full-unstyled-link"> iPhone 18 Pro Max </a>
<span class="price-item">From ₹ 178,900.00 </span>`;
const apt = parseAptronixSearch(aptronix, 'iphone 18 pro max');
assert.equal(apt?.price, 178900);
assert.equal(apt?.store, 'Aptronix');

assert.equal(formatInr(178900), '₹1,78,900');

const pages: Record<string, string> = {
  'https://www.amazon.in/s?k=iphone%2018%20pro%20max': amazon,
  'https://www.flipkart.com/search?q=iphone%2018%20pro%20max': flipkart,
  'https://www.poorvika.com/s?q=iphone+18+pro+max': poorvika,
  'https://www.aptronixindia.com/search?q=iphone+18+pro+max': aptronix,
  'https://html.duckduckgo.com/html/?q=iphone%2018%20pro%20max%20price': `
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.nykaa.com%2Fthe-ordinary-serum%2Fp%2F1&amp;rut=1">The Ordinary serum</a>
    <a class="result__a" href="https://www.youtube.com/watch?v=1">iPhone 18 Pro Max Rs 10</a>
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.croma.com%2Fapple-iphone-18-pro-max%2Fp%2F9&amp;rut=9">Apple iPhone 18 Pro Max 256GB</a> Rs 1,74,900
  `,
  'https://www.croma.com/apple-iphone-18-pro-max/p/9': `
    <meta property="og:title" content="Apple iPhone 18 Pro Max 256GB" />
    <script>"priceCurrency":"INR","price":"174900"</script>
  `,
};
const offers = await comparePrices('iphone 18 pro max', async (input) => {
  const url = String(input);
  const body = pages[url];
  if (!body) throw new Error(`unexpected ${url}`);
  return new Response(body, { status: 200 });
});
assert.deepEqual(offers.map((offer) => offer.store), ['Croma', 'Aptronix', 'Amazon.in', 'Flipkart', 'Poorvika']);
assert.equal(offers[0].price, 174900);

const leads = parseWebLeads(pages['https://html.duckduckgo.com/html/?q=iphone%2018%20pro%20max%20price']);
assert.equal(leads.some((lead) => lead.url.includes('youtube')), false);
assert.equal(leads.find((lead) => lead.url.includes('croma'))?.price, 174900);
const pageOffer = parsePagePrice(pages['https://www.croma.com/apple-iphone-18-pro-max/p/9'], 'iphone 18 pro max', 'https://www.croma.com/apple-iphone-18-pro-max/p/9');
assert.equal(pageOffer?.store, 'Croma');

console.log('price compare tests passed');
