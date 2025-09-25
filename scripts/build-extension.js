#!/usr/bin/env node
/**
 * Post-build script to package the web extension
 * This handles what vite-plugin-web-extension couldn't due to IIFE/ES module conflicts
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const targetBrowser = process.env.TARGET_BROWSER || 'chrome'
const manifestVersion = targetBrowser === 'firefox' ? 'v2' : 'v3'
const distDir = path.join(rootDir, 'dist', targetBrowser)

async function buildExtension() {
  console.log('🔧 Building extension package...')

  try {
    // 1. First run the standard Vite build
    console.log('📦 Running Vite build...')
    const { execSync } = await import('child_process')
    execSync('vite build', { stdio: 'inherit', cwd: rootDir })

    // 2. Copy manifest
    console.log('📄 Copying manifest...')
    const manifestSrc = path.join(rootDir, 'manifest', manifestVersion, 'manifest.json')
    const manifestDest = path.join(distDir, 'manifest.json')
    await fs.copy(manifestSrc, manifestDest)

    // 3. Copy static assets (icons, etc.)
    console.log('🎨 Copying static assets...')
    const staticDir = path.join(rootDir, 'static')
    if (await fs.pathExists(staticDir)) {
      await fs.copy(staticDir, distDir, {
        overwrite: true,
        filter: (src) => !src.includes('.DS_Store')
      })
    }

    // Ensure icons are in the correct location for manifest
    const iconsSource = path.join(distDir, 'icons')
    const iconsTarget = path.join(distDir, 'assets', 'icons')
    if (await fs.pathExists(iconsSource)) {
      await fs.ensureDir(path.join(distDir, 'assets'))
      await fs.move(iconsSource, iconsTarget, { overwrite: true })
    }

    // 4. Fix popup.html path
    console.log('🔗 Fixing popup.html location...')
    const popupSrc = path.join(distDir, 'src/popup/popup.html')
    const popupDest = path.join(distDir, 'popup.html')
    if (await fs.pathExists(popupSrc)) {
      await fs.move(popupSrc, popupDest, { overwrite: true })
      // Update script src in popup.html
      let popupContent = await fs.readFile(popupDest, 'utf8')
      popupContent = popupContent.replace('src="./popup.ts"', 'src="./popup.js"')
      await fs.writeFile(popupDest, popupContent)
    }

    // 5. Clean up unnecessary directories
    console.log('🧹 Cleaning up...')
    const srcDir = path.join(distDir, 'src')
    if (await fs.pathExists(srcDir)) {
      await fs.remove(srcDir)
    }

    // 6. Validate the extension structure
    console.log('✅ Validating extension structure...')
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'content-script.js',
      'popup.html',
      'popup.js'
    ]

    for (const file of requiredFiles) {
      const filePath = path.join(distDir, file)
      if (!await fs.pathExists(filePath)) {
        console.error(`❌ Missing required file: ${file}`)
      } else {
        const stats = await fs.stat(filePath)
        console.log(`✓ ${file} (${(stats.size / 1024).toFixed(2)} KB)`)
      }
    }

    console.log(`\n✨ Extension built successfully at: ${distDir}`)
    console.log('📌 You can now load this directory as an unpacked extension in your browser')

  } catch (error) {
    console.error('❌ Build failed:', error.message)
    process.exit(1)
  }
}

// Run the build
buildExtension()