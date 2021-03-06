const { AuthenticationError } = require('apollo-server-express');
const { User, Ticket } = require('../models');
const { signToken } = require('../utils/auth');

const resolvers = {
  Query: {
    users: async () => {
      return User.find().populate('tickets');
    },
    user: async (parent, { username }) => {
      return User.findOne({ username }).populate('tickets');
    },
    tickets: async (parent, { username }) => {
      const params = username ? { username } : {};
      return Ticket.find(params).sort({ createdAt: -1 });
    },
    ticket: async (parent, { ticketId }) => {
      return Ticket.findOne({ _id: ticketId });
    },
    me: async (parent, args, context) => {
      if (context.user) {
        return User.findOne({ _id: context.user._id }).populate('tickets');
      }
      throw new AuthenticationError('You need to be logged in!');
    },
  },

  Mutation: {
    addUser: async (parent, { username, email, password, department, team }) => {
      const user = await User.create({ username, email, password, department, team });
      const token = signToken(user);
      return { token, user };
    },
    login: async (parent, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        throw new AuthenticationError('No user found with this email address');
      }

      const correctPw = await user.isCorrectPassword(password);

      if (!correctPw) {
        throw new AuthenticationError('Incorrect credentials');
      }

      const token = signToken(user);

      return { token, user };
    },
    addTicket: async (parent, { ticketText, ticketTeam, ticketPhone, ticketEmail, ticketName, ticketDepartment, ticketStatus }, context) => {
      if (context.user) {
        const ticket = await Ticket.create({
          ticketText,
          ticketTeam,
          ticketPhone,
          ticketEmail,
          ticketName,
          ticketDepartment,
          ticketStatus,
          ticketAuthor: context.user.username,
        });

        await User.findOneAndUpdate(
          { _id: context.user._id },
          { $addToSet: { tickets: ticket._id } }
        );

        return ticket;
      }
      throw new AuthenticationError('You need to be logged in!');
    },
    addComment: async (parent, { ticketId, commentText }, context) => {
      if (context.user) {
        return Ticket.findOneAndUpdate(
          { _id: ticketId },
          {
            $addToSet: {
              comments: { commentText, commentAuthor: context.user.username },
            },
          },
          {
            new: true,
            runValidators: true,
          }
        );
      }
      throw new AuthenticationError('You need to be logged in!');
    },
    removeTicket: async (parent, { ticketId }, context) => {
      if (context.user) {
        const ticket = await Ticket.findOneAndDelete({
          _id: ticketId,
          ticketAuthor: context.user.username,
        });

        return ticket;
      }
      throw new AuthenticationError('You need to be logged in!');
    },
    removeComment: async (parent, { ticketId, commentId }, context) => {
      if (context.user) {
        return Ticket.findOneAndUpdate(
          { _id: ticketId },
          {
            $pull: {
              comments: {
                _id: commentId,
                commentAuthor: context.user.username,
              },
            },
          },
          { new: true }
        );
      }
      throw new AuthenticationError('You need to be logged in!');
    },
  },
};

module.exports = resolvers;
