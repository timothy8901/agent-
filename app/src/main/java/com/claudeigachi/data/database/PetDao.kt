package com.claudeigachi.data.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface PetDao {
    @Query("SELECT * FROM pets WHERE id = 1")
    fun observePet(): Flow<PetEntity?>

    @Query("SELECT * FROM pets WHERE id = 1")
    suspend fun getPet(): PetEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun savePet(pet: PetEntity)

    @Query("DELETE FROM pets")
    suspend fun deleteAll()
}
