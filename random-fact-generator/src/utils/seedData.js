#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import Fact from '../src/models/Fact.js';
import logger from '../src/utils/logger.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedDatabase() {
  try {
    logger.info('🌱 Starting database seeding...');
    
    // Connect to database
    await connectToDatabase();
    logger.info('✅ Connected to database');
    
    // Check if facts already exist
    const existingFactsCount = await Fact.countDocuments();
    
    if (existingFactsCount > 0) {
      logger.info(`Database already contains ${existingFactsCount} facts`);
      
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Do you want to clear existing facts and reseed? (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y') {
        logger.info('Seeding cancelled');
        return;
      }
      
      // Clear existing facts
      await Fact.deleteMany({});
      logger.info('🗑️  Cleared existing facts');
    }
    
    // Read initial facts data
    const factsFilePath = path.join(__dirname, '../data/facts_clean.json');
    const factsData = await fs.readFile(factsFilePath, 'utf8');
    const { facts } = JSON.parse(factsData);
    
    logger.info(`📚 Loading ${facts.length} initial facts...`);
    
    // Process and insert facts
    const processedFacts = facts.map(fact => ({
      ...fact,
      created_at: new Date(),
      updated_at: new Date(),
      view_count: Math.floor(Math.random() * 100), // Random initial views
      likes: Math.floor(Math.random() * 50), // Random initial likes
      ai_generated: false,
      featured: Math.random() < 0.1 // 10% chance to be featured
    }));
    
    // Insert facts in batches
    const batchSize = 10;
    let insertedCount = 0;
    
    for (let i = 0; i < processedFacts.length; i += batchSize) {
      const batch = processedFacts.slice(i, i + batchSize);
      
      try {
        await Fact.insertMany(batch, { ordered: false });
        insertedCount += batch.length;
        logger.info(`✅ Inserted batch ${Math.ceil((i + 1) / batchSize)} (${batch.length} facts)`);
      } catch (error) {
        logger.error(`❌ Error inserting batch ${Math.ceil((i + 1) / batchSize)}:`, error);
        
        // Try inserting individually to identify problematic facts
        for (const fact of batch) {
          try {
            await Fact.create(fact);
            insertedCount++;
            logger.info(`✅ Individually inserted: ${fact.fact.substring(0, 50)}...`);
          } catch (individualError) {
            logger.error(`❌ Failed to insert fact: ${fact.fact.substring(0, 50)}...`, individualError);
          }
        }
      }
    }
    
    // Verify insertion
    const finalCount = await Fact.countDocuments();
    logger.info(`🎉 Database seeding completed!`);
    logger.info(`📊 Total facts in database: ${finalCount}`);
    logger.info(`✅ Successfully inserted: ${insertedCount}`);
    
    // Generate some statistics
    const stats = await Fact.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          verified: { $sum: { $cond: ['$verified', 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    logger.info('📈 Facts by category:');
    stats.forEach(stat => {
      logger.info(`  ${stat._id}: ${stat.count} facts (${stat.verified} verified)`);
    });
    
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
    logger.info('🔌 Disconnected from database');
    process.exit(0);
  }
}

// Run seeding if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase();
}

export default seedDatabase;
