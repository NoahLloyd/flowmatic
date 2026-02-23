import React, { useState, useEffect } from "react";
import SessionsOverview from "../../components/session/SessionsOverview";
import { useAuth } from "../../context/AuthContext";

interface UserStats {
  todayHours: number;
  weekHours: number;
  averageFocus: number;
}

const Friends = () => {
  const { user } = useAuth();
  const userName = user?.id || "You";

  const [friends, setFriends] = useState<string[]>([]);
  const [newFriend, setNewFriend] = useState("");
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({});

  useEffect(() => {
    const storedFriends = localStorage.getItem("friends");
    if (storedFriends) {
      try {
        setFriends(JSON.parse(storedFriends));
      } catch (error) {
        console.error("Error parsing friends from localStorage:", error);
        setFriends([]);
      }
    }
  }, []);

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriend.trim()) return;

    const updatedFriends = [...friends, newFriend.trim()];
    setFriends(updatedFriends);
    localStorage.setItem("friends", JSON.stringify(updatedFriends));
    setNewFriend("");
  };

  const handleRemoveFriend = (friendToRemove: string) => {
    const updatedFriends = friends.filter(
      (friend) => friend !== friendToRemove
    );
    setFriends(updatedFriends);
    localStorage.setItem("friends", JSON.stringify(updatedFriends));
  };

  const handleStatsUpdate = (userId: string, stats: UserStats) => {
    setUserStats((prev) => ({
      ...prev,
      [userId]: stats,
    }));
  };

  return (
    <div className="flex gap-4 p-4 bg-white dark:bg-gray-900">
      {/* Friends List Box */}
      <div className="w-1/4 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <form onSubmit={handleAddFriend} className="mb-4">
          <input
            type="text"
            placeholder="Add friend"
            value={newFriend}
            onChange={(e) => setNewFriend(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
        </form>
        <ul className="space-y-2">
          {friends.map((friend, index) => (
            <li
              key={index}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg flex justify-between items-center"
            >
              <span className="dark:text-white">{friend}</span>
              <button
                onClick={() => handleRemoveFriend(friend)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Sessions Overview Bar */}
      <div className="w-full flex flex-col gap-4">
        <div className="w-full">
          <SessionsOverview
            userId={userName}
            onStatsCalculated={(stats) => handleStatsUpdate(userName, stats)}
          />
        </div>
        {friends.map((friend, index) => (
          <div key={index} className="w-full">
            <SessionsOverview
              userId={friend}
              onStatsCalculated={(stats) => handleStatsUpdate(friend, stats)}
              deleteItems={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Friends;
