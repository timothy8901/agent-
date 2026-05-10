package com.claudeigachi.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [PetEntity::class, ChatMessageEntity::class],
    version = 1,
    exportSchema = false
)
abstract class PetDatabase : RoomDatabase() {
    abstract fun petDao(): PetDao
    abstract fun chatDao(): ChatDao

    companion object {
        @Volatile private var INSTANCE: PetDatabase? = null

        fun getInstance(context: Context): PetDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    PetDatabase::class.java,
                    "claude_igachi.db"
                ).build().also { INSTANCE = it }
            }
    }
}
