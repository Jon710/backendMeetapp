import * as Yup from 'yup';
import { Op } from 'sequelize';
import {
  isBefore,
  startOfDay,
  endOfDay,
  parseISO,
  startOfHour,
} from 'date-fns';
import Meetup from '../models/Meetup';
import User from '../models/User';
import File from '../models/File';

class MeetupController {
  async index(req, res) {
    const where = {};
    const page = req.query.page || 1;

    if (req.query.date) {
      const searchDate = parseISO(req.query.date);

      where.date = {
        [Op.between]: [startOfDay(searchDate), endOfDay(searchDate)],
      };
    }

    const meetups = await Meetup.findAll({
      where,
      include: [User],
      limit: 10,
      offset: 10 * page - 10,
    });

    return res.json(meetups);
  }

  async myMeetups(req, res) {
    const page = 1;

    const meetups = await Meetup.findAll({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: File,
          attributes: ['id', 'path', 'url'],
        },
      ],
      order: ['date'],
      limit: 10,
      offset: 10 * page - 10,
    });

    return res.json(meetups);
  }

  async details(req, res) {
    // const { id } = req.params;
    const meet_id = req.params.id;
    const {
      file_id,
      description,
      title,
      location,
      date,
      imgMeetup,
    } = await Meetup.findOne({
      where: { id: meet_id },
      include: {
        model: File,
        as: 'imgMeetup',
        attributes: ['path', 'id', 'name', 'url'],
      },
      attributes: ['file_id', 'description', 'title', 'location', 'date', 'id'],
    });

    return res.json({
      file_id,
      description,
      title,
      location,
      date,
      imgMeetup,
      meet_id,
    });
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string().required(),
      description: Yup.string().required(),
      location: Yup.string().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Informações invalidas' });
    }

    const { title, description, location, date, banner } = req.body;
    const user_id = req.userId;

    const startDate = startOfHour(parseISO(date));

    if (isBefore(startDate, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permitted' });
    }

    const meetUp = await Meetup.create({
      title,
      description,
      location,
      date: startDate,
      file_id: banner,
      user_id,
    });

    const addBannerInfos = await Meetup.findOne({
      where: {
        id: meetUp.id,
      },
      include: [
        {
          model: File,
          attributes: ['id', 'path', 'url'],
        },
      ],
    });

    return res.json(addBannerInfos);
  }

  async update(req, res) {
    const { id: meetUpId } = req.params;

    const meetapp = await Meetup.findOne({
      where: {
        id: meetUpId,
        user_id: req.userId,
      },
    });

    if (!meetapp) {
      return res.status(400).json({ error: 'Meetup not found' });
    }

    if (isBefore(meetapp.date, new Date())) {
      return res.status(400).json({ error: 'Not allowed to edit past meetup' });
    }

    const { date } = req.body;

    const dateStart = startOfHour(parseISO(date));

    if (date) {
      if (isBefore(dateStart, new Date())) {
        return res.status(400).json({ error: 'Past dates are not allowed' });
      }
    }

    const { title, description, location, file_id } = await meetapp.update(
      req.body
    );

    return res.json({ title, description, location, file_id, date });
  }

  async delete(req, res) {
    const user_id = req.userId;

    const meetup = await Meetup.findByPk(req.params.id);

    if (meetup.user_id !== user_id) {
      return res.status(401).json({ error: 'Not authorized.' });
    }

    if (meetup.past) {
      return res.status(400).json({ error: "You can't delete past meetups." });
    }

    await meetup.destroy();

    return res.send();
  }
}

export default new MeetupController();
