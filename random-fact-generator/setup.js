#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Random Fact Generator API - Development Setup');
console.log('================================================\n');

async function checkPrerequisites() {
  console.log('📋 Checking prerequisites...');
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      console.log('❌ Node.js 18 or higher is required. Current version:', nodeVersion);
      process.exit(1);
    }
    console.log(`✅ Node.js ${nodeVersion}`);
    
    // Check npm
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`✅ npm ${npmVersion}`);
    
    // Check if MongoDB is running (optional)
    try {
      execSync('mongosh --eval "db.runCommand({ping: 1})" --quiet', { stdio: 'ignore' });
      console.log('✅ MongoDB is running');
    } catch (error) {
      console.log('⚠️  MongoDB not detected (you can use Docker or install locally)');
    }
    
    // Check if Redis is running (optional)
    try {
      execSync('redis-cli ping', { stdio: 'ignore' });
      console.log('✅ Redis is running');
    } catch (error) {
      console.log('⚠️  Redis not detected (optional for development)');
    }
    
  } catch (error) {
    console.log('❌ Prerequisites check failed:', error.message);
    process.exit(1);
  }
}

async function setupEnvironment() {
  console.log('\n🔧 Setting up environment...');
  
  try {
    // Check if .env exists
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, '.env.example');
    
    try {
      await fs.access(envPath);
      console.log('✅ .env file exists');
    } catch (error) {
      console.log('📄 Creating .env file from template...');
      const envExample = await fs.readFile(envExamplePath, 'utf8');
      await fs.writeFile(envPath, envExample);
      console.log('✅ .env file created');
      console.log('⚠️  Please update the .env file with your actual values (especially GITHUB_TOKEN)');
    }
    
  } catch (error) {
    console.log('❌ Environment setup failed:', error.message);
    process.exit(1);
  }
}

async function createDirectories() {
  console.log('\n📁 Creating necessary directories...');
  
  const directories = [
    'logs',
    'uploads',
    'temp'
  ];
  
  for (const dir of directories) {
    try {
      await fs.mkdir(path.join(__dirname, dir), { recursive: true });
      console.log(`✅ Created ${dir} directory`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.log(`❌ Failed to create ${dir} directory:`, error.message);
      }
    }
  }
}

async function showNextSteps() {
  console.log('\n🎉 Setup completed successfully!');
  console.log('=====================================\n');
  
  console.log('Next steps:');
  console.log('1. Update your .env file with actual values:');
  console.log('   - Add your GitHub token (GITHUB_TOKEN)');
  console.log('   - Verify database URLs');
  console.log('   - Update other configuration as needed\n');
  
  console.log('2. Start the development services:');
  console.log('   Option A - Using Docker (recommended):');
  console.log('     docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d');
  console.log('');
  console.log('   Option B - Using local services:');
  console.log('     # Start MongoDB and Redis locally, then:');
  console.log('     npm run dev\n');
  
  console.log('3. Seed the database with initial data:');
  console.log('     npm run seed\n');
  
  console.log('4. Access the API:');
  console.log('   - API: http://localhost:3000');
  console.log('   - Health Check: http://localhost:3000/health');
  console.log('   - API Documentation: http://localhost:3000/api-docs\n');
  
  console.log('5. VS Code tasks available:');
  console.log('   - Ctrl+Shift+P → "Tasks: Run Task" → "Start Random Fact Generator API"');
  console.log('   - Or use the terminal: npm run dev\n');
  
  console.log('6. Testing:');
  console.log('   npm test                    # Run all tests');
  console.log('   npm run test:unit          # Run unit tests');
  console.log('   npm run test:integration   # Run integration tests\n');
  
  console.log('7. Health check:');
  console.log('   npm run health             # Check all services\n');
  
  console.log('📚 For more information, see README.md');
  console.log('🐛 For issues, check the logs in the logs/ directory');
}

async function main() {
  try {
    await checkPrerequisites();
    await setupEnvironment();
    await createDirectories();
    await showNextSteps();
  } catch (error) {
    console.log('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
