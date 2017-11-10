#!/bin/bash

cp systemd-WaterDispenserServer.service /etc/systemd/system/WaterDispenserServer.service
systemctl enable WaterDispenserServer.service
systemctl start WaterDispenserServer.service
