export function SearchForm({ props }) {
  return (
    <form>
      <input type="text" placeholder="Search products" />
      <input type="email" name="email" />
      <label htmlFor="qty">Quantity</label>
      <input id="qty" type="number" />
      <label>
        Remember me <input type="checkbox" />
      </label>
      <input type="hidden" name="token" />
      <input {...props} />
      <select name="sort"><option>Newest</option></select>
      <iframe src="https://www.youtube.com/embed/xyz" />
    </form>
  );
}
