import React, { useState } from 'react';
import { ShoppingCart, Heart, Star, Sparkles, Search } from 'lucide-react';

export default function Banner() {
  return (
    <section className="relative bg-gradient-to-br from-[#3FE0D0] via-[#5FEDE0] to-[#7FF5ED] overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="text-white z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Promo Spesial Hari Ini</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-4">
              Cantik Setiap Hari.
            </h1>
            <p className="text-5xl sm:text-7xl font-bold mb-6 bg-gradient-to-r from-pink-400 to-rose-500 bg-clip-text text-transparent">
              Diskon 40%!
            </p>
            <p className="text-lg sm:text-xl mb-8 text-white/90">
              Produk skincare & makeup favorit, 100% original. Gratis ongkir*.
            </p>
            <a
              href="#produk"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#3FE0D0] text-lg font-semibold hover:shadow-2xl hover:scale-105 transition-all duration-300"
            >
              Belanja Sekarang
              <ShoppingCart className="w-5 h-5" />
            </a>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-white/30 backdrop-blur-xl rounded-3xl transform rotate-6"></div>
            <div className="relative bg-white/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=600&fit=crop"
                alt="Beauty Products"
                className="w-full h-80 object-cover rounded-2xl shadow-lg"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl">
                <p className="text-sm text-gray-600 font-medium">Trusted by</p>
                <p className="text-2xl font-bold text-[#3FE0D0]">10,000+</p>
                <p className="text-xs text-gray-500">Happy Customers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
