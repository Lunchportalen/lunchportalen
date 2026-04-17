# Lunchportalen — AWS-grunnmur (ECS cluster + valgfri ALB).
# ECS Fargate service krever task definition, VPC og sikkerhetsgrupper — se ecs-service.tf.example.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "eu-west-1"
}

variable "alb_subnet_ids" {
  type        = list(string)
  description = "Minst to offentlige subnet-IDer for Application Load Balancer"
  default     = []
}

resource "aws_ecs_cluster" "app" {
  name = "lunchportalen-cluster"
}

resource "aws_lb" "app_lb" {
  count              = length(var.alb_subnet_ids) >= 2 ? 1 : 0
  name               = "lp-app-lb"
  load_balancer_type = "application"
  subnets            = var.alb_subnet_ids
  internal           = false
}

output "cluster_name" {
  value       = aws_ecs_cluster.app.name
  description = "ECS cluster"
}

output "cluster_arn" {
  value       = aws_ecs_cluster.app.arn
  description = "ECS cluster ARN"
}

output "endpoint" {
  value       = length(aws_lb.app_lb) > 0 ? aws_lb.app_lb[0].dns_name : null
  description = "ALB DNS (null inntil alb_subnet_ids er satt)"
}
