const fs = require('fs');
const path = require('path');

async function addSessionsToSchema() {
  try {
    console.log('📝 Adding sessions table to schema.ts...');
    
    const schemaPath = path.join(__dirname, 'shared', 'schema.ts');
    let schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Find the users table definition
    const usersTablePattern = /export const users = pgTable\("users", \{[\s\S]*?\}\);?/;
    const usersMatch = schemaContent.match(usersTablePattern);
    
    if (!usersMatch) {
      console.error('❌ Could not find users table in schema.ts');
      return;
    }
    
    // Create the sessions table definition
    const sessionsTable = `
// Sessions table for authentication
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: integer("user_id").references(() => users.id).notNull(),
  data: text("data").notNull(), // JSON string containing session data
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});`;
    
    // Insert sessions table after users table
    const updatedContent = schemaContent.replace(
      usersMatch[0],
      usersMatch[0] + sessionsTable
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(schemaPath, updatedContent);
    
    console.log('✅ Sessions table added to schema.ts successfully!');
    
    // Also add the sessions relations if they don't exist
    if (!updatedContent.includes('sessionsRelations')) {
      console.log('📝 Adding sessions relations...');
      
      // Find where relations are defined (usually after table definitions)
      const relationsPattern = /export const \w+Relations = relations/;
      const relationsMatch = updatedContent.match(relationsPattern);
      
      if (relationsMatch) {
        const sessionsRelations = `
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));`;
        
        // Add sessions relations before the first existing relation
        const finalContent = updatedContent.replace(
          relationsMatch[0],
          sessionsRelations + '\n\n' + relationsMatch[0]
        );
        
        fs.writeFileSync(schemaPath, finalContent);
        console.log('✅ Sessions relations added to schema.ts successfully!');
      }
    }
    
    // Add sessions types if they don't exist
    if (!updatedContent.includes('export type Session')) {
      console.log('📝 Adding sessions types...');
      
      const typePattern = /export type \w+ = typeof \w+\.\$inferSelect;/;
      const typeMatch = updatedContent.match(typePattern);
      
      if (typeMatch) {
        const sessionsTypes = `
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;`;
        
        // Add sessions types before the first existing type
        const finalContent = updatedContent.replace(
          typeMatch[0],
          sessionsTypes + '\n\n' + typeMatch[0]
        );
        
        fs.writeFileSync(schemaPath, finalContent);
        console.log('✅ Sessions types added to schema.ts successfully!');
      }
    }
    
    console.log('\n🎉 Sessions schema added successfully!');
    console.log('\n📋 What was added:');
    console.log('  - sessions table definition');
    console.log('  - sessions relations');
    console.log('  - Session and InsertSession types');
    
  } catch (error) {
    console.error('❌ Error adding sessions to schema:', error.message);
  }
}

addSessionsToSchema(); 