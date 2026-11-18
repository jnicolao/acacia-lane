import Image from "next/image";
import { AddToCart } from "@/components/add-to-cart";
import { kes } from "@/lib/format";
import { products } from "@/lib/products";

export default function Storefront() {
  return (
    <>
      <section className="mb-8 max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Kenyan-made goods, delivered to your door
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-stone-500">
          Small-batch food and handmade homeware. Order with just your
          WhatsApp number: PickSpot brings it to your door and you pay by
          M-Pesa.
        </p>
      </section>

      <ul className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3 md:gap-5">
        {products.map((product) => (
          <li
            key={product.id}
            className="group @container flex flex-col rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-shadow duration-200 ease-out hover:shadow-[0_10px_28px_-14px_rgb(0_0_0/0.22)]"
          >
            {/* Card radius 16px, padding 8px, so the picture's radius is 8px. */}
            <div className="relative aspect-3/2 overflow-hidden rounded-lg bg-stone-100 after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-1 after:ring-black/5 after:ring-inset">
              <Image
                src={product.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 304px, (min-width: 600px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
              />
            </div>
            <div className="flex flex-1 flex-col px-1 pt-3 pb-1.5">
              <h2 className="text-sm leading-snug font-medium">{product.name}</h2>
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-stone-500">
                {product.description}
              </p>
              {/* Narrow cards: price above a full-width button. Wide cards: one row. */}
              <div className="mt-auto flex flex-col gap-2 pt-3 @[13rem]:flex-row @[13rem]:items-center @[13rem]:justify-between">
                <span className="text-sm font-semibold tabular-nums">
                  {kes(product.price)}
                </span>
                <AddToCart productId={product.id} name={product.name} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
