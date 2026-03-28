
import { createServer as createViteServer } from 'vite';
import express from 'express';
import dotenv from 'dotenv';

console.log('Testing imports...');
console.log('Vite:', typeof createViteServer);
console.log('Express:', typeof express);
console.log('Dotenv:', typeof dotenv);

async function testFetch() {
  try {
    const nodeFetch = await import('node-fetch');
    console.log('Node-fetch loaded');
  } catch (e) {
    console.error('Node-fetch failed:', e);
  }
}

testFetch();
