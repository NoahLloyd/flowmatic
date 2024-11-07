import React, { useState, useEffect } from "react";
import SessionsOverview from "../../components/session/SessionsOverview";

interface UserStats {
  todayHours: number;
  weekHours: number;
  averageFocus: number;
}

const Home = () => {
  const [friends, setFriends] = useState<string[]>([]);
  const [newFriend, setNewFriend] = useState("");
  const userName = localStorage.getItem("name")?.replace(/^"|"$/g, "") || "You";
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

  const renderUserStats = (userId: string) => {
    const stats = userStats[userId];
    if (!stats)
      return (
        <div className="flex items-center justify-between bg-white px-4 py-3 mb-2 rounded-lg border">
          <h3 className="text-lg font-bold text-slate-600 mr-4">{userId}</h3>
          <div className="flex gap-1">
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-2 rounded-2xl">
              0h today
            </span>
          </div>
        </div>
      );

    return (
      <div className="flex items-center justify-between bg-white px-4 py-3 mb-2 rounded-lg border">
        <h3 className="text-lg font-bold text-slate-600 mr-4">{userId}</h3>
        <div className="flex gap-1">
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-2 rounded-2xl">
            {stats.todayHours}h today
          </span>
          <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-2 rounded-2xl">
            {stats.weekHours}h week
          </span>
          <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-2 rounded-2xl">
            {stats.averageFocus}/5 focus
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-4 p-4">
      {/* Friends List Box */}
      <div className="w-1/4 bg-white rounded-lg shadow p-4">
        <form onSubmit={handleAddFriend} className="mb-4">
          <input
            type="text"
            placeholder="Add friend"
            value={newFriend}
            onChange={(e) => setNewFriend(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
        <ul className="space-y-2">
          {friends.map((friend, index) => (
            <li
              key={index}
              className="px-3 py-2 bg-gray-50 rounded-lg flex justify-between items-center"
            >
              <span>{friend}</span>
              <button
                onClick={() => handleRemoveFriend(friend)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Sessions Overview Bar */}
      <div className="w-full flex flex-col md:flex-row gap-4 items-start">
        <div className="flex-1">
          {renderUserStats(userName)}
          <SessionsOverview
            userId={'"' + userName + '"'}
            onStatsCalculated={(stats) => handleStatsUpdate(userName, stats)}
          />
        </div>
        {friends.map((friend, index) => (
          <div key={index} className="flex-1">
            {renderUserStats(friend)}
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

export default Home;
